// SPDX-License-Identifier: GPL-3.0-or-later
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal static class ApplicationControl {
    internal sealed class App {
        public string name;
        public string processName;
        public string path;
    }

    private static string Local { get { return Environment.GetEnvironmentVariable("LOCALAPPDATA"); } }
    private static readonly int Session = Process.GetCurrentProcess().SessionId;

    internal static bool IsAllowed(string kind, string file) {
        if (String.IsNullOrEmpty(file) || !Path.IsPathRooted(file)) return false;
        file = Path.GetFullPath(file);
        if (kind == "Discord") {
            if (String.IsNullOrEmpty(Local) || !String.Equals(Path.GetFileName(file), "Discord.exe", StringComparison.OrdinalIgnoreCase)) return false;
            string app = Path.GetDirectoryName(file);
            return Regex.IsMatch(Path.GetFileName(app), @"^app-\d+(\.\d+){1,3}$", RegexOptions.IgnoreCase) &&
                String.Equals(Path.GetDirectoryName(app), Path.Combine(Local, "Discord"), StringComparison.OrdinalIgnoreCase);
        }
        if (kind != "StreamDeck") return false;
        foreach (string variable in new [] { "ProgramW6432", "ProgramFiles", "ProgramFiles(x86)" }) {
            string folder = Environment.GetEnvironmentVariable(variable);
            if (!String.IsNullOrEmpty(folder) && String.Equals(file, Path.Combine(folder, "Elgato", "StreamDeck", "StreamDeck.exe"), StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static List<Process> Running(App app) {
        var result = new List<Process>();
        foreach (Process process in Process.GetProcessesByName(app.processName)) {
            try {
                if (process.HasExited || process.SessionId != Session) { process.Dispose(); continue; }
                string file = process.MainModule.FileName;
                if (!IsAllowed(app.processName, file)) throw new InvalidOperationException("Une autre installation de " + app.name + " est ouverte. Fermeture automatique refusee.");
                result.Add(process);
            } catch (InvalidOperationException) {
                bool exited;
                try { exited = process.HasExited; } catch { exited = true; }
                process.Dispose();
                if (!exited) { DisposeAll(result); throw; }
            } catch {
                process.Dispose(); DisposeAll(result);
                throw new InvalidOperationException("Impossible d'identifier le processus " + app.name + ". Aucun processus inconnu ne sera ferme.");
            }
        }
        return result;
    }

    private static void DisposeAll(List<Process> processes) { foreach (Process process in processes) process.Dispose(); }
    private static bool IsRunning(App app) { var processes = Running(app); bool found = processes.Count > 0; DisposeAll(processes); return found; }

    internal static List<App> Discover() {
        var apps = new List<App>();
        string discord = null;
        Version newest = null;
        if (!String.IsNullOrEmpty(Local) && Directory.Exists(Path.Combine(Local, "Discord"))) {
            foreach (string directory in Directory.GetDirectories(Path.Combine(Local, "Discord"), "app-*")) {
                Version version;
                string file = Path.Combine(directory, "Discord.exe");
                if (IsAllowed("Discord", file) && Version.TryParse(Path.GetFileName(directory).Substring(4), out version) && File.Exists(file) &&
                    (newest == null || version > newest)) { newest = version; discord = file; }
            }
        }
        string streamDeck = null;
        foreach (string variable in new [] { "ProgramW6432", "ProgramFiles", "ProgramFiles(x86)" }) {
            string folder = Environment.GetEnvironmentVariable(variable);
            if (String.IsNullOrEmpty(folder)) continue;
            string file = Path.Combine(folder, "Elgato", "StreamDeck", "StreamDeck.exe");
            if (IsAllowed("StreamDeck", file) && File.Exists(file)) { streamDeck = file; break; }
        }
        if (discord == null) throw new InvalidOperationException("Discord Stable est introuvable. Installe-le avant de continuer.");
        if (streamDeck == null) throw new InvalidOperationException("Stream Deck est introuvable dans son emplacement habituel. Installe-le avant de continuer.");
        apps.Add(new App { name = "Discord", processName = "Discord", path = discord });
        apps.Add(new App { name = "Stream Deck", processName = "StreamDeck", path = streamDeck });
        // Validate every running target before any shutdown is attempted.
        foreach (App app in apps) DisposeAll(Running(app));
        return apps;
    }

    private static void Stop(List<App> apps) {
        foreach (App app in apps) {
            var processes = Running(app);
            try { foreach (Process process in processes) { try { process.CloseMainWindow(); } catch (InvalidOperationException) {} } }
            finally { DisposeAll(processes); }
        }
        var timer = Stopwatch.StartNew();
        while (timer.ElapsedMilliseconds < 4000) {
            bool any = false;
            foreach (App app in apps) if (IsRunning(app)) any = true;
            if (!any) return;
            Thread.Sleep(200);
        }
        // Tray applications may hide instead of quitting. Only the validated
        // Discord/StreamDeck executables in this Windows session are terminated.
        foreach (App app in apps) {
            var processes = Running(app);
            try { foreach (Process process in processes) { try { process.Kill(); } catch (InvalidOperationException) {} } }
            finally { DisposeAll(processes); }
        }
        timer.Restart();
        while (timer.ElapsedMilliseconds < 8000) {
            bool any = false;
            foreach (App app in apps) if (IsRunning(app)) any = true;
            if (!any) return;
            Thread.Sleep(200);
        }
        throw new InvalidOperationException("Une application est encore ouverte. Les fichiers ne peuvent pas etre modifies.");
    }

    private static void Start(List<App> apps) {
        var errors = new List<string>();
        foreach (App app in apps) {
            try {
                if (IsRunning(app)) continue;
                if (!IsAllowed(app.processName, app.path) || !File.Exists(app.path)) throw new IOException("Executable introuvable.");
                // Detach the GUI applications from the installer's output pipes.
                var start = new ProcessStartInfo(app.path) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(app.path) };
                using (Process launched = Process.Start(start)) {}
                var timer = Stopwatch.StartNew();
                while (timer.ElapsedMilliseconds < 12000 && !IsRunning(app)) Thread.Sleep(250);
                if (!IsRunning(app)) throw new IOException("Le processus ne demarre pas.");
                Console.WriteLine(app.name + " relance.");
            } catch { errors.Add(app.name); }
        }
        if (errors.Count > 0) throw new IOException("Relance automatique impossible pour " + String.Join(" et ", errors) + ". Ouvre ces applications manuellement.");
    }

    public static int Main(string[] args) {
        Console.OutputEncoding = new UTF8Encoding(false);
        try {
            if (args.Length != 1 || (args[0] != "plan" && args[0] != "stop" && args[0] != "start")) throw new ArgumentException("Commande de gestion des applications invalide.");
            List<App> apps = Discover();
            if (args[0] == "plan") Console.WriteLine(new JavaScriptSerializer().Serialize(apps));
            else if (args[0] == "stop") { Stop(apps); Console.WriteLine("Discord et Stream Deck sont fermes."); }
            else Start(apps);
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
