namespace AidedCam.Dwg;

// The engine's result for one file (spec §3 contract). Lengths in metres, areas in m², coordinates in metres.
public sealed class Result
{
    public string Format = "dwg";                  // "dwg" or "dxf"
    public string Version = "";                    // AutoCAD version name, e.g. "2018"
    public string Units = "mm";                    // what the file states: mm, cm, m, inch, ft, … or "none"
    public string UnitsSource = "file";            // "file", "setting", "assumed" or "override"
    public string Used = "mm";                     // the unit the scale came from: the override, the file's, the setting's, or mm
    public List<LayerTotal> Layers = new();
    public List<BlockCount> Blocks = new();
    public List<Schedule> Schedules = new();
    public List<Item> Items = new();
    public List<string> Xrefs = new();
    public NotMeasured NotMeasured = new();
    public List<Warning> Warnings = new();
    public double X0, Y0, X1, Y1;                   // bounding box of every item's path
    public bool Simplified;                        // drawing paths were coarsened to stay within the point budget
}

public sealed class LayerTotal
{
    public string Name = "0";
    public string Color = "#ffffff";               // #rrggbb of the layer
    public bool Off, Frozen;
    public double Len, Area, HatchArea;
    public int LenCount, AreaCount, HatchCount, Bad;
}

public sealed class BlockCount
{
    public string Name = "", Layer = "0";
    public int Count;                              // model-space inserts (a MINSERT counts rows × columns)
    public int Nested;                             // inserts found inside other blocks, times their placements
}

public sealed class Schedule
{
    public string Block = "";
    public List<string> Tags = new();
    public List<ScheduleRow> Rows = new();
}

public sealed class ScheduleRow
{
    public List<string> Values = new();
    public int Count;
}

// One drawable thing: a curve, a hatch, or a whole block insert. Paths are flat [x0, y0, x1, y1, …] polylines.
public sealed class Item
{
    public string Id = "";                         // DWG handle, hex
    public string Layer = "0";
    public string Kind = "line";                   // line, arc, circle, polyline, spline, ellipse, hatch, insert
    public double Len, Area;
    public string Block;                           // effective block name, inserts only
    public int Copies = 1;                         // a MINSERT's rows × columns
    public bool Bad;                               // area that cannot be trusted: left out of the totals
    public List<double[]> Path = new();
}

public sealed class NotMeasured
{
    public int Text, Dim, Solid3d, Mesh, Proxy, Other, InsideBlocks;
}

public sealed class Warning
{
    public string Id = "";
    public List<(string Key, string Value)> Params = new();
}

public sealed class Settings
{
    public string Units = "auto";                  // for files that state no units: auto, mm, cm, m, inch, ft
    public string Override = "";                   // the visitor's correction for one file, whatever it states: mm, cm, m, inch, ft
}

// A file the engine refuses. Reason is one of: read, version, limit, empty (all in paper space), blank.
public sealed class DwgFileException(string reason, string message) : Exception(message)
{
    public string Reason { get; } = reason;
}

public static class Limits
{
    public const int MaxBytes = 30 * 1024 * 1024;
    public const int MaxEntities = 300_000;        // model-space entities
    public const int MaxPathPoints = 1_000_000;    // above this the drawing is coarsened (Result.Simplified)
}
