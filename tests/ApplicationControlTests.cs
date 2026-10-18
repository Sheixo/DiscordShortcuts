// SPDX-License-Identifier: GPL-3.0-or-later
using System;
using System.IO;

internal static class ApplicationControlTests {
    private static int count;
    private static void Check(bool condition, string name) {
        if (!condition) throw new Exception(name);
        count++;
    }
    public static int Main() {
        string local = Path.Combine(Path.GetTempPath(), "assistant-test-local");
        string programs = Path.Combine(Path.GetTempPath(), "assistant-test-programs");
        Environment.SetEnvironmentVariable("LOCALAPPDATA", local);
        foreach (string variable in new [] { "ProgramW6432", "ProgramFiles", "ProgramFiles(x86)" }) Environment.SetEnvironmentVariable(variable, programs);
        string discord = Path.Combine(local, "Discord", "app-1.0.9262", "Discord.exe");
        string streamDeck = Path.Combine(programs, "Elgato", "StreamDeck", "StreamDeck.exe");
        Check(ApplicationControl.IsAllowed("Discord", discord), "Official Stable executable accepted");
        Check(ApplicationControl.IsAllowed("Discord", discord.ToUpperInvariant()), "Windows path casing accepted");
        Check(ApplicationControl.IsAllowed("StreamDeck", streamDeck), "Official Stream Deck executable accepted");
        Check(!ApplicationControl.IsAllowed("Discord", "Discord.exe"), "Relative executable refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "DiscordPTB", "app-1.0.9262", "Discord.exe")), "PTB refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "DiscordCanary", "app-1.0.9262", "Discord.exe")), "Canary refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "Discord-other", "app-1.0.9262", "Discord.exe")), "Adjacent folder refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "Discord", "unknown", "Discord.exe")), "Unknown version folder refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "Discord", "app-1.0.9262", "node.exe")), "Other executables refused");
        Check(!ApplicationControl.IsAllowed("Discord", Path.Combine(local, "Discord", "app-1.0.9262", "..", "..", "other", "Discord.exe")), "Traversal outside allowed root refused");
        Check(!ApplicationControl.IsAllowed("StreamDeck", Path.Combine(programs, "Other", "StreamDeck.exe")), "Unrelated StreamDeck executable refused");
        Check(!ApplicationControl.IsAllowed("StreamDeck", Path.Combine(programs, "Elgato", "StreamDeck", "node.exe")), "Plugin Node process refused");
        Check(!ApplicationControl.IsAllowed("Unknown", discord), "Unknown application refused");
        Check(!ApplicationControl.IsAllowed("Discord", null), "Missing executable refused");
        Console.WriteLine(count + " native application path checks passed.");
        return 0;
    }
}
