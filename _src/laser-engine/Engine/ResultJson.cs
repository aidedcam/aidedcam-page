using System.Text.Json;

namespace AidedCam.Laser;

// The result as JSON for the page (spec §3 contract). Written by hand with Utf8JsonWriter:
// reflection-based serialization is disabled in a trimmed WebAssembly build.
public static class ResultJson
{
    static double R4(double v) => Math.Round(v, 4);

    public static string Write(string name, Result r)
    {
        var ms = new MemoryStream();
        using (var w = new Utf8JsonWriter(ms, new JsonWriterOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }))
        {
            var d = r.Drawing;
            w.WriteStartObject();
            w.WriteString("type", "result");
            w.WriteStartObject("file");
            w.WriteString("name", name); w.WriteString("format", d.Format); w.WriteString("version", d.Version);
            w.WriteString("units", d.Units); w.WriteString("unitsSource", d.UnitsSource);
            w.WriteEndObject();

            w.WriteStartArray("groups");
            foreach (var g in d.Groups)
            {
                w.WriteStartObject();
                w.WriteString("key", g.Key); w.WriteString("layer", g.Layer); w.WriteString("color", g.Color);
                w.WriteString("linetype", g.LineType); w.WriteString("role", g.Role); w.WriteString("defaultRole", g.DefaultRole);
                w.WriteNumber("curves", g.Curves);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("parts");
            foreach (var p in r.Parts)
            {
                w.WriteStartObject();
                w.WriteNumber("id", p.Id); w.WriteNumber("outer", p.Outer);
                w.WriteStartArray("holes"); foreach (var h in p.Holes) w.WriteNumberValue(h); w.WriteEndArray();
                w.WriteNumber("area", R4(p.Area));
                w.WriteStartObject("bbox"); w.WriteNumber("w", R4(p.Max.X - p.Min.X)); w.WriteNumber("h", R4(p.Max.Y - p.Min.Y)); w.WriteEndObject();
                w.WriteNumber("cutLength", R4(p.CutLength)); w.WriteNumber("pierces", p.Pierces);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("extras");
            w.WriteNumber("openCutLength", R4(r.OpenCutLength)); w.WriteNumber("openPierces", r.OpenPierces);
            w.WriteNumber("markLength", R4(r.MarkLength)); w.WriteNumber("markStarts", r.MarkStarts);
            w.WriteEndObject();

            w.WriteStartArray("contours");
            foreach (var c in r.Contours)
            {
                w.WriteStartObject();
                w.WriteNumber("id", c.Id); w.WriteString("role", c.Role); w.WriteBoolean("closed", c.Closed);
                w.WriteNumber("length", R4(c.Length));
                if (c.Part >= 0) w.WriteNumber("part", c.Part); else w.WriteNull("part");
                w.WriteBoolean("isHole", c.IsHole);
                w.WriteStartArray("segs");
                foreach (var s in c.Segs)
                {
                    w.WriteStartObject();
                    if (s.Kind == SegKind.Line)
                    {
                        w.WriteString("t", "L");
                        w.WriteNumber("x1", R4(s.A.X)); w.WriteNumber("y1", R4(s.A.Y)); w.WriteNumber("x2", R4(s.B.X)); w.WriteNumber("y2", R4(s.B.Y));
                    }
                    else if (s.Kind == SegKind.Circle)
                    {
                        w.WriteString("t", "C"); w.WriteNumber("cx", R4(s.C.X)); w.WriteNumber("cy", R4(s.C.Y)); w.WriteNumber("r", R4(s.R));
                    }
                    else
                    {
                        w.WriteString("t", "A"); w.WriteNumber("cx", R4(s.C.X)); w.WriteNumber("cy", R4(s.C.Y)); w.WriteNumber("r", R4(s.R));
                        w.WriteNumber("a0", R4(s.StartAngle * 180 / Math.PI)); w.WriteNumber("a1", R4(s.EndAngle * 180 / Math.PI));
                        w.WriteBoolean("ccw", s.Ccw);
                    }
                    w.WriteEndObject();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("texts");
            foreach (var t in d.Texts)
            {
                w.WriteStartObject();
                w.WriteNumber("x", R4(t.At.X)); w.WriteNumber("y", R4(t.At.Y)); w.WriteNumber("h", R4(t.Height));
                w.WriteNumber("rot", R4(t.Rotation)); w.WriteString("value", t.Value);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("markers");
            foreach (var m in r.Markers)
            {
                w.WriteStartObject();
                w.WriteString("kind", m.Kind); w.WriteNumber("x", R4(m.At.X)); w.WriteNumber("y", R4(m.At.Y));
                if (m.Size > 0) w.WriteNumber("size", R4(m.Size));
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("checks");
            foreach (var c in r.Checks)
            {
                w.WriteStartObject();
                w.WriteString("id", c.Id); w.WriteString("severity", c.Severity);
                w.WriteStartObject("params");
                foreach (var (k, v) in c.Params)
                {
                    switch (v)
                    {
                        case int i: w.WriteNumber(k, i); break;
                        case double x: w.WriteNumber(k, x); break;
                        default: w.WriteString(k, v?.ToString() ?? ""); break;
                    }
                }
                w.WriteEndObject();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("stats");
            w.WriteNumber("curvesIn", r.CurvesIn); w.WriteNumber("tinyRemoved", r.Stats.TinyRemoved);
            w.WriteNumber("duplicatesRemoved", r.Stats.DuplicatesRemoved); w.WriteNumber("overlapsMerged", r.Stats.OverlapsMerged);
            w.WriteNumber("gapsClosed", r.Stats.GapsClosed); w.WriteNumber("maxGapClosed", R4(r.Stats.MaxGapClosed));
            w.WriteStartObject("ignored");
            foreach (var (k, v) in d.Ignored) w.WriteNumber(k, v);
            w.WriteEndObject();
            w.WriteEndObject();

            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    public static string Error(string name, string reason, string message)
    {
        var ms = new MemoryStream();
        using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "error"); w.WriteString("name", name); w.WriteString("reason", reason); w.WriteString("message", message);
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }
}
