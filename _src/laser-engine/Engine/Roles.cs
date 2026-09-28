namespace AidedCam.Laser;

// Default roles from the layer name (spec §7). Matching is case- and accent-insensitive, Greek and English.
public static class Roles
{
    public const string Cut = "cut", Mark = "mark", Bend = "bend", Ignore = "ignore";
    public static readonly string[] All = { Cut, Mark, Bend, Ignore };

    static readonly string[] MarkWords = { "mark", "engrave", "etch", "χαραξ", "σημανσ" };
    static readonly string[] BendWords = { "bend", "fold", "καμψ", "στραντζ" };
    static readonly string[] IgnoreWords = { "dim", "defpoints", "construction", "center", "centre", "αξον", "διαστασ" };
    static readonly string[] DashedWords = { "DASH", "HIDDEN", "CENTER", "CENTRE", "PHANTOM", "DOT", "DIVIDE", "BORDER" };

    public static string Default(string layer)
    {
        string s = Fold(layer ?? "");
        if (MarkWords.Any(s.Contains)) return Mark;
        if (BendWords.Any(s.Contains)) return Bend;
        if (IgnoreWords.Any(s.Contains)) return Ignore;
        return Cut;
    }

    public static bool IsDashed(string lineType)
    {
        string s = (lineType ?? "").ToUpperInvariant();
        return DashedWords.Any(s.Contains);
    }

    public static bool IsRole(string role) => Array.IndexOf(All, role) >= 0;

    // Lower case without Greek accents. Written out by hand: the browser runs in invariant globalization.
    public static string Fold(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (char ch in s.ToLowerInvariant())
        {
            sb.Append(ch switch
            {
                'ά' => 'α', 'έ' => 'ε', 'ή' => 'η', 'ί' or 'ϊ' or 'ΐ' => 'ι', 'ό' => 'ο', 'ύ' or 'ϋ' or 'ΰ' => 'υ', 'ώ' => 'ω', 'ς' => 'σ',
                _ => ch,
            });
        }
        return sb.ToString();
    }
}
