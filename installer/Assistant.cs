// SPDX-License-Identifier: GPL-3.0-or-later
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Discord Shortcuts Assistant")]
[assembly: System.Reflection.AssemblyVersion("0.1.0.0")]

internal sealed class Assistant : Form {
    private readonly Color background = Color.FromArgb(18, 22, 31);
    private readonly Color panel = Color.FromArgb(27, 33, 45);
    private readonly Color muted = Color.FromArgb(165, 177, 198);
    private readonly List<Button> actions = new List<Button>();
    private TextBox source;
    private TextBox log;
    private Label status;
    private Label summary;
    private ProgressBar progress;
    private Button browse;
    private Process worker;
    private string jobFile;
    private string lastResult;
    private readonly bool preview;
    private readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    private const string Guide = "https://github.com/Sheixo/DiscordShortcuts/blob/main/docs/INSTALLATION.fr.md";

    [STAThread] private static void Main(string[] args) {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Assistant(Array.IndexOf(args, "--preview") >= 0));
    }

    private Assistant(bool previewMode) {
        preview = previewMode;
        Text = "Discord Shortcuts — Assistant" + (preview ? " — Aperçu" : "");
        ClientSize = new Size(940, 780);
        MinimumSize = new Size(956, 819);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = background;
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10F);
        AutoScaleMode = AutoScaleMode.Dpi;

        Label title = TextLabel("Discord Shortcuts", 30, 22, 650, 43, 25, Color.White);
        title.Font = new Font("Segoe UI Semibold", 25F);
        TextLabel("Installer, réparer ou retirer les deux composants depuis une seule fenêtre.", 32, 72, 860, 27, 11, muted);
        TextLabel("WINDOWS  ·  DISCORD STABLE  ·  VENCORD REQUIS", 33, 106, 720, 25, 9, muted);
        Label version = TextLabel("Assistant 0.1.0", 775, 32, 140, 26, 9, muted);
        version.TextAlign = ContentAlignment.MiddleRight;

        Panel location = new Panel { Location = new Point(30, 145), Size = new Size(880, 110), BackColor = panel };
        Controls.Add(location);
        Label pathTitle = new Label { Text = "Dossier des sources Vencord", Location = new Point(16, 12), Size = new Size(780, 24) };
        location.Controls.Add(pathTitle);
        source = new TextBox { Location = new Point(16, 44), Size = new Size(716, 29), BackColor = background, ForeColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle, Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Vencord") };
        location.Controls.Add(source);
        browse = new Button { Text = "Parcourir…", Location = new Point(744, 42), Size = new Size(120, 31), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(43, 53, 71) };
        browse.FlatAppearance.BorderSize = 0;
        browse.Click += delegate { using (FolderBrowserDialog dialog = new FolderBrowserDialog()) {
            dialog.Description = "Choisis le dossier contenant src, package.json et les autres sources Vencord.";
            if (Directory.Exists(source.Text)) dialog.SelectedPath = source.Text;
            if (dialog.ShowDialog(this) == DialogResult.OK) source.Text = dialog.SelectedPath;
        } };
        location.Controls.Add(browse);
        Label hint = new Label { Text = "Garde ton dossier existant si tu utilises d’autres plugins personnalisés.", Location = new Point(17, 80), Size = new Size(830, 22), ForeColor = muted, Font = new Font("Segoe UI", 9F) };
        location.Controls.Add(hint);

        AddAction("Tout installer", "Connecteur Vencord + plugin Stream Deck", "install-all", 30, 275, Color.FromArgb(82, 99, 227));
        AddAction("Stream Deck uniquement", "Installer ou mettre à jour le compagnon", "install-streamdeck", 480, 275, Color.FromArgb(43, 69, 102));
        AddAction("Vérifier / Réparer", "Reconstruire et appliquer les bons fichiers", "repair", 30, 367, Color.FromArgb(38, 104, 91));
        AddAction("Tout désinstaller", "Retirer Discord Shortcuts et son connecteur", "uninstall", 480, 367, Color.FromArgb(125, 52, 63));

        summary = TextLabel("Vencord, tes autres plugins et tes profils Stream Deck sont conservés à la désinstallation.", 32, 468, 870, 35, 9, muted);
        status = TextLabel(preview ? "Aperçu — les opérations sont désactivées." : "Prêt. Tu peux vérifier les fichiers sans rien modifier.", 32, 514, 870, 28, 11, Color.White);
        progress = new ProgressBar { Location = new Point(32, 550), Size = new Size(876, 5), Style = ProgressBarStyle.Blocks };
        Controls.Add(progress);
        log = new TextBox { Location = new Point(32, 570), Size = new Size(876, 137), Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical,
            BackColor = panel, ForeColor = muted, Font = new Font("Consolas", 9F), BorderStyle = BorderStyle.None, Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right };
        log.Text = "Les opérations et les éventuelles erreurs s’afficheront ici.\r\nAucune fermeture automatique de Discord ou Stream Deck.";
        Controls.Add(log);
        Button check = new Button { Text = "Vérifier seulement", Location = new Point(32, 728), Size = new Size(170, 30), FlatStyle = FlatStyle.Flat, BackColor = panel, Anchor = AnchorStyles.Bottom | AnchorStyles.Left };
        check.FlatAppearance.BorderSize = 0;
        check.Click += delegate { StartJob("check"); };
        Controls.Add(check); actions.Add(check);
        LinkLabel help = new LinkLabel { Text = "Guide et prérequis", Location = new Point(700, 733), Size = new Size(208, 25), TextAlign = ContentAlignment.MiddleRight,
            LinkColor = Color.FromArgb(157, 183, 255), ActiveLinkColor = Color.White, Anchor = AnchorStyles.Bottom | AnchorStyles.Right };
        help.LinkClicked += delegate { Process.Start(new ProcessStartInfo(Guide) { UseShellExecute = true }); };
        Controls.Add(help);
        FormClosing += delegate(object sender, FormClosingEventArgs e) {
            if (worker != null) { e.Cancel = true; MessageBox.Show(this, "Une opération est en cours. Attends sa fin pour fermer l’assistant.", "Opération en cours", MessageBoxButtons.OK, MessageBoxIcon.Information); }
        };
    }

    private Label TextLabel(string text, int x, int y, int width, int height, float size, Color color) {
        Label label = new Label { Text = text, Location = new Point(x, y), Size = new Size(width, height), ForeColor = color, Font = new Font("Segoe UI", size) };
        Controls.Add(label); return label;
    }

    private void AddAction(string title, string description, string action, int x, int y, Color color) {
        Button button = new Button { Text = title + "\n" + description, Location = new Point(x, y), Size = new Size(430, 77),
            FlatStyle = FlatStyle.Flat, BackColor = color, ForeColor = Color.White, TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(17, 0, 5, 0), Font = new Font("Segoe UI", 11F), Cursor = Cursors.Hand };
        button.FlatAppearance.BorderSize = 0;
        button.Click += delegate { StartJob(action); };
        Controls.Add(button); actions.Add(button);
    }

    private string NodePath() {
        string portable = Path.Combine(root, "runtime", "node.exe");
        if (File.Exists(portable)) return portable;
        string programFiles = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
        if (File.Exists(programFiles)) return programFiles;
        foreach (string item in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';')) {
            try { string candidate = Path.Combine(item.Trim().Trim('"'), "node.exe"); if (File.Exists(candidate)) return Path.GetFullPath(candidate); }
            catch (ArgumentException) { }
        }
        return null;
    }

    internal static string QuoteArgument(string value) {
        StringBuilder result = new StringBuilder("\""); int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') result.Append('\\', slashes * 2 + 1);
            else result.Append('\\', slashes);
            slashes = 0; result.Append(c);
        }
        result.Append('\\', slashes * 2); result.Append('"'); return result.ToString();
    }

    private void StartJob(string action) {
        if (preview) { status.Text = "Aperçu : aucune installation ni désinstallation n’a été exécutée."; return; }
        if (worker != null) return;
        string node = NodePath();
        if (node == null) {
            if (action == "install-streamdeck") {
                string package = Path.Combine(root, "fr.ethan.discord-shortcuts.streamDeckPlugin");
                if (File.Exists(package)) {
                    Process.Start(new ProcessStartInfo(package) { UseShellExecute = true });
                    status.Text = "Installateur Stream Deck ouvert. Termine l’installation dans Stream Deck.";
                    return;
                }
            }
            MessageBox.Show(this, "Node.js 22 ou une version LTS plus récente est requis. Le guide contient le lien d’installation officiel.", "Prérequis manquant", MessageBoxButtons.OK, MessageBoxIcon.Information); return;
        }
        if (action == "uninstall") {
            if (MessageBox.Show(this, "Retirer Discord Shortcuts de Stream Deck et son connecteur ShortcutToggle de Vencord ?\n\nVencord, les autres plugins, les raccourcis Discord et les profils Stream Deck seront conservés. Une sauvegarde sera créée.\n\nFerme complètement Discord et Stream Deck avant de continuer.", "Désinstaller Discord Shortcuts", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
        } else if (action != "check") {
            string apps = action == "install-streamdeck" ? "Stream Deck" : "Discord et Stream Deck";
            if (MessageBox.Show(this, "Ferme complètement " + apps + " depuis leurs icônes près de l’horloge, puis clique sur OK.\n\nL’assistant vérifiera leur fermeture avant de modifier les fichiers.", "Préparer l’opération", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return;
        }
        try {
            jobFile = Path.Combine(Path.GetTempPath(), "discord-shortcuts-job-" + Guid.NewGuid().ToString("N") + ".json");
            var job = new Dictionary<string, object> { { "action", action }, { "source", source.Text }, { "confirmed", action == "uninstall" } };
            File.WriteAllText(jobFile, new JavaScriptSerializer().Serialize(job), new UTF8Encoding(false));
            ProcessStartInfo start = new ProcessStartInfo(node, QuoteArgument(Path.Combine(root, "scripts", "launcher-runner.cjs")) + " --job " + QuoteArgument(jobFile)) {
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
            };
            // Inherit the same Windows environment as the command-line assistant.
            worker = new Process { StartInfo = start, EnableRaisingEvents = true };
            worker.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) UiLog(e.Data); };
            worker.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) UiLog(e.Data); };
            worker.Exited += delegate { worker.WaitForExit(); BeginInvoke(new Action(CompleteJob)); };
            SetBusy(true); lastResult = null; log.Clear(); status.Text = action == "check" ? "Vérification des fichiers…" : "Opération en cours…";
            worker.Start(); worker.BeginOutputReadLine(); worker.BeginErrorReadLine();
        } catch (Exception error) { CleanupJob(); SetBusy(false); status.Text = "L’opération n’a pas pu démarrer."; log.AppendText(error.Message); }
    }

    private void UiLog(string line) {
        if (IsDisposed) return;
        BeginInvoke(new Action(delegate {
            if (line.StartsWith("@@RESULT ")) { lastResult = line.Substring(9); return; }
            if (line.StartsWith("@@STATUS ")) { status.Text = line.Substring(9); return; }
            log.AppendText(line + Environment.NewLine);
        }));
    }

    private void CompleteJob() {
        Process finished = worker;
        if (finished == null) return;
        finished.WaitForExit();
        int code = finished.ExitCode;
        if (code == 0) status.Text = String.IsNullOrEmpty(lastResult) ? "Opération terminée." : lastResult;
        else status.Text = "Opération arrêtée. Le détail ci-dessous indique quoi corriger.";
        CleanupJob(); SetBusy(false);
    }

    private void CleanupJob() {
        if (worker != null) { worker.Dispose(); worker = null; }
        if (jobFile != null) { try { File.Delete(jobFile); } catch (IOException) { } jobFile = null; }
    }

    private void SetBusy(bool busy) {
        foreach (Button button in actions) button.Enabled = !busy;
        source.Enabled = !busy; browse.Enabled = !busy;
        progress.Style = busy ? ProgressBarStyle.Marquee : ProgressBarStyle.Blocks;
    }
}
