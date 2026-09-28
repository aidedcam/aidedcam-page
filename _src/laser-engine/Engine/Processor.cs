namespace AidedCam.Laser;

public sealed class Check
{
    public string Id, Severity;
    public Dictionary<string, object> Params = new();
}

public sealed class Result
{
    public Drawing Drawing;
    public List<Contour> Contours = new();
    public List<PartInfo> Parts = new();
    public List<Marker> Markers = new();
    public RepairStats Stats = new();
    public List<Check> Checks = new();
    public double OpenCutLength, MarkLength;
    public int OpenPierces, MarkStarts, CurvesIn;
    public byte[] Dxf;
}

// The whole pipeline for one file: read, repair per role, chain, parts, checks, repaired DXF.
public static class Processor
{
    public static Result Process(byte[] bytes, Settings s)
    {
        var d = Reader.Read(bytes, s);
        var r = new Result { Drawing = d, CurvesIn = d.Segs.Count };
        List<Seg> OfRole(string role) => d.Segs.Where(x => d.Groups[x.Group].Role == role).ToList();

        // Cut: every repair step, then contours and parts.
        var cutIn = OfRole(Roles.Cut);
        int branches = 0;
        var cutSegs = Repair.MergeOverlaps(Repair.RemoveTiny(cutIn, r.Stats), s.JoinTol, r.Stats);
        var cutGraph = Repair.Join(cutSegs, s.JoinTol, s.GapTol, r.Stats, r.Markers);
        var cut = Chains.Build(cutGraph, Roles.Cut, r.Markers, ref branches);

        // Mark: the same repair, so doubled engraving is not run twice; its markers are not reported.
        var scratch = new List<Marker>();
        int markBranches = 0;
        var markSegs = Repair.MergeOverlaps(Repair.RemoveTiny(OfRole(Roles.Mark), r.Stats), s.JoinTol, r.Stats);
        var mark = Chains.Build(Repair.Join(markSegs, s.JoinTol, 0, r.Stats, scratch), Roles.Mark, scratch, ref markBranches);

        // Bend lines are kept as they are (duplicates removed); ignored geometry is only drawn.
        var bend = Repair.MergeOverlaps(Repair.RemoveTiny(OfRole(Roles.Bend), r.Stats), s.JoinTol, r.Stats)
            .Select(x => new Contour { Role = Roles.Bend, Closed = x.Kind == SegKind.Circle, Segs = { x } });
        var ignore = OfRole(Roles.Ignore).Select(x => new Contour { Role = Roles.Ignore, Closed = x.Kind == SegKind.Circle, Segs = { x } });

        r.Contours.AddRange(cut); r.Contours.AddRange(mark); r.Contours.AddRange(bend); r.Contours.AddRange(ignore);
        for (int i = 0; i < r.Contours.Count; i++) r.Contours[i].Id = i;

        var closedCut = cut.Where(c => c.Closed).ToList();
        int selfX = Chains.SelfIntersections(closedCut, r.Markers);
        r.Parts = Chains.Parts(closedCut);
        var openCut = cut.Where(c => !c.Closed).ToList();
        r.OpenCutLength = openCut.Sum(c => c.Length);
        r.OpenPierces = openCut.Count;
        r.MarkLength = mark.Sum(c => c.Length);
        r.MarkStarts = mark.Count;

        // Checks (spec §9), most serious first.
        void Add(string id, string severity, params (string k, object v)[] ps)
        {
            var c = new Check { Id = id, Severity = severity };
            foreach (var (k, v) in ps) c.Params[k] = v;
            r.Checks.Add(c);
        }
        if (d.EmptyBlocks.Count > 0) Add("block-empty", "error", ("blocks", string.Join(", ", d.EmptyBlocks)));
        if (d.NestedArrays.Count > 0) Add("block-array", "error", ("blocks", string.Join(", ", d.NestedArrays)));
        if (cut.Count == 0) Add("empty-cut", "error");
        if (openCut.Count > 0) Add("open-path", "error", ("count", openCut.Count), ("length", Math.Round(r.OpenCutLength, 2)));
        if (branches > 0) Add("branch", "warn", ("count", branches));
        if (selfX > 0) Add("self-intersect", "warn", ("count", selfX));
        var dashed = d.Groups.Where(g => g.Role == Roles.Cut && Roles.IsDashed(g.LineType)).Select(g => g.Layer).Distinct().ToList();
        if (dashed.Count > 0) Add("dashed-on-cut", "warn", ("layers", string.Join(", ", dashed)));
        if (d.NotFlat) Add("not-flat", "warn");
        if (d.UnitsSource == "assumed") Add("units-assumed", "warn");
        if (d.UnitsSource == "file" && d.Units == "inch") Add("units-inch", "info");
        if (r.Stats.GapsClosed > 0) Add("gaps-closed", "info", ("count", r.Stats.GapsClosed), ("max", Math.Round(r.Stats.MaxGapClosed, 3)));
        if (r.Stats.DuplicatesRemoved > 0) Add("duplicates-removed", "info", ("count", r.Stats.DuplicatesRemoved), ("length", Math.Round(r.Stats.DuplicateLength, 2)));
        if (r.Stats.TinyRemoved > 0) Add("tiny-removed", "info", ("count", r.Stats.TinyRemoved));
        if (d.Texts.Count > 0) Add("text-kept", "info", ("count", d.Texts.Count));
        if (d.Ignored.Values.Sum() > 0)
            Add("ignored-entities", "info", ("hatch", d.Ignored["hatch"]), ("dim", d.Ignored["dim"]), ("leader", d.Ignored["leader"]), ("point", d.Ignored["point"]), ("other", d.Ignored["other"]));
        if (r.Parts.Count > 1) Add("multi-part", "info", ("count", r.Parts.Count));

        r.Dxf = DxfR12.Write(r.Contours, d.Texts);
        return r;
    }
}
