namespace AidedCam.Laser;

// Geometry that shares a layer and a colour. Every group has exactly one role (spec §7).
public sealed class Group
{
    public string Layer = "0";
    public string Color = "#000000";          // resolved colour, #rrggbb
    public string LineType = "CONTINUOUS";    // resolved linetype name, upper case
    public int Curves;                        // pieces read on this group
    public string DefaultRole = Roles.Cut;
    public string Role = Roles.Cut;
    public string Key => Layer + "|" + Color;
}

public sealed class TextItem
{
    public P At;
    public double Height;
    public double Rotation;                   // degrees
    public string Value = "";
}

// What the reader returns: pieces in millimetres on the XY plane, plus everything the checks need.
public sealed class Drawing
{
    public string Format = "dxf";             // "dxf" or "dwg"
    public string Version = "";               // AutoCAD version name, e.g. "R12", "2018"
    public string Units = "mm";               // units the file said: "mm", "inch", "cm", "m", "ft" or "none"
    public string UnitsSource = "file";       // "file", "assumed" or "setting"
    public List<Seg> Segs = new();
    public List<Group> Groups = new();
    public List<TextItem> Texts = new();
    public bool NotFlat;
    public SortedSet<string> EmptyBlocks = new();   // block references that came in without geometry (R12 blocks, see spec §9)
    public SortedSet<string> NestedArrays = new();  // blocks holding an arrayed insert (MINSERT), read once only
    public Dictionary<string, int> Ignored = new() { ["hatch"] = 0, ["dim"] = 0, ["leader"] = 0, ["point"] = 0, ["other"] = 0 };
}

public sealed class Settings
{
    public string Units = "auto";             // "auto", "mm" or "inch"
    public double JoinTol = 0.01;             // mm
    public double GapTol = 0.2;               // mm
    public Dictionary<string, string> Roles = new();   // group key → role, from the roles table
}

// A file the engine refuses. Reason is one of: read, version, limit.
public sealed class LaserFileException(string reason, string message) : Exception(message)
{
    public string Reason { get; } = reason;
}

public static class Limits
{
    public const int MaxBytes = 20 * 1024 * 1024;
    public const int MaxCurves = 200_000;
    public const double Tiny = 0.001;        // mm: shorter pieces are removed
}
