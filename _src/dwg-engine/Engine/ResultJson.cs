using System.Text.Json;

namespace AidedCam.Dwg;

// The result as JSON for the page (spec §3 contract). Written by hand with Utf8JsonWriter: reflection-based
// serialization is disabled in a trimmed WebAssembly build.
public static class ResultJson
{
    static double R6(double v) => Math.Round(v, 6);
    static double R4(double v) => Math.Round(v, 4);

    static Utf8JsonWriter Writer(Stream s) =>
        new(s, new JsonWriterOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    public static string Write(string name, Result r)
    {
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "result");
            w.WriteStartObject("file");
            w.WriteString("name", name); w.WriteString("format", r.Format); w.WriteString("version", r.Version);
            w.WriteString("units", r.Units); w.WriteString("unitsSource", r.UnitsSource);
            w.WriteString("used", r.Used);
            w.WriteEndObject();

            w.WriteStartArray("layers");
            foreach (var l in r.Layers)
            {
                w.WriteStartObject();
                w.WriteString("name", l.Name); w.WriteString("color", l.Color);
                w.WriteBoolean("off", l.Off); w.WriteBoolean("frozen", l.Frozen);
                w.WriteNumber("len", R6(l.Len)); w.WriteNumber("lenCount", l.LenCount);
                w.WriteNumber("area", R6(l.Area)); w.WriteNumber("areaCount", l.AreaCount);
                w.WriteNumber("hatchArea", R6(l.HatchArea)); w.WriteNumber("hatchCount", l.HatchCount);
                w.WriteNumber("bad", l.Bad);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("blocks");
            foreach (var b in r.Blocks)
            {
                w.WriteStartObject();
                w.WriteString("name", b.Name); w.WriteString("layer", b.Layer);
                w.WriteNumber("count", b.Count); w.WriteNumber("nested", b.Nested);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("schedules");
            foreach (var s in r.Schedules)
            {
                w.WriteStartObject();
                w.WriteString("block", s.Block);
                w.WriteStartArray("tags"); foreach (var t in s.Tags) w.WriteStringValue(t); w.WriteEndArray();
                w.WriteStartArray("rows");
                foreach (var row in s.Rows)
                {
                    w.WriteStartObject();
                    w.WriteStartArray("values"); foreach (var v in row.Values) w.WriteStringValue(v); w.WriteEndArray();
                    w.WriteNumber("count", row.Count);
                    w.WriteEndObject();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("items");
            foreach (var it in r.Items)
            {
                w.WriteStartObject();
                w.WriteString("id", it.Id); w.WriteString("layer", it.Layer); w.WriteString("kind", it.Kind);
                w.WriteNumber("len", R6(it.Len)); w.WriteNumber("area", R6(it.Area));
                if (it.Block != null) w.WriteString("block", it.Block); else w.WriteNull("block");
                w.WriteNumber("copies", it.Copies); w.WriteBoolean("bad", it.Bad);
                if (it.Verts != null) WriteVerts(w, "verts", it.Verts);
                w.WriteStartArray("path");
                foreach (var line in it.Path)
                {
                    w.WriteStartArray();
                    foreach (var v in line) w.WriteNumberValue(R4(v));
                    w.WriteEndArray();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("xrefs"); foreach (var x in r.Xrefs) w.WriteStringValue(x); w.WriteEndArray();

            var nm = r.NotMeasured;
            w.WriteStartObject("notMeasured");
            w.WriteNumber("text", nm.Text); w.WriteNumber("dim", nm.Dim); w.WriteNumber("solid3d", nm.Solid3d);
            w.WriteNumber("mesh", nm.Mesh); w.WriteNumber("proxy", nm.Proxy); w.WriteNumber("other", nm.Other);
            w.WriteNumber("insideBlocks", nm.InsideBlocks);
            w.WriteEndObject();

            w.WriteStartArray("warnings");
            foreach (var wn in r.Warnings)
            {
                w.WriteStartObject();
                w.WriteString("id", wn.Id);
                w.WriteStartObject("params"); foreach (var (key, value) in wn.Params) w.WriteString(key, value); w.WriteEndObject();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("bbox");
            w.WriteNumber("x0", R4(r.X0)); w.WriteNumber("y0", R4(r.Y0)); w.WriteNumber("x1", R4(r.X1)); w.WriteNumber("y1", R4(r.Y1));
            w.WriteEndObject();
            w.WriteBoolean("simplified", r.Simplified);
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    public static string Error(string name, string reason, string message)
    {
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "error"); w.WriteString("name", name);
            w.WriteString("reason", reason); w.WriteString("message", message ?? "");
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    // True vertices: coordinates to 0.1 mm like the paths would lose, so to the micrometre; bulges to 1e-12.
    static void WriteVerts(Utf8JsonWriter w, string name, double[] v)
    {
        if (name != null) w.WriteStartArray(name); else w.WriteStartArray();
        for (int i = 0; i + 2 < v.Length; i += 3) { w.WriteNumberValue(R6(v[i])); w.WriteNumberValue(R6(v[i + 1])); w.WriteNumberValue(Math.Round(v[i + 2], 12)); }
        w.WriteEndArray();
    }

    // The union of the last file's closed items (coverage pre-check, spec §3): { type: 'union', area, paths,
    // verts, bad, parts } or, when the booleans failed, the same with error set. Never throws.
    public static string Union(string idsJson)
    {
        UnionResult u;
        try
        {
            var ids = new List<string>();
            using (var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(idsJson) ? "[]" : idsJson))
                foreach (var e in doc.RootElement.EnumerateArray()) if (e.ValueKind == JsonValueKind.String) ids.Add(e.GetString());
            u = AidedCam.Dwg.Union.Of(ids);
        }
        catch (Exception ex) { u = new UnionResult { Error = ex.GetType().Name }; }
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "union");
            w.WriteNumber("area", R6(u.Area));
            w.WriteNumber("parts", u.Parts);
            w.WriteStartArray("paths");
            foreach (var line in u.Paths) { w.WriteStartArray(); foreach (var v in line) w.WriteNumberValue(R4(v)); w.WriteEndArray(); }
            w.WriteEndArray();
            w.WriteStartArray("verts");
            foreach (var v in u.Verts) WriteVerts(w, null, v);
            w.WriteEndArray();
            w.WriteStartArray("bad"); foreach (var b in u.Bad) w.WriteStringValue(b); w.WriteEndArray();
            if (u.Error != null) w.WriteString("error", u.Error); else w.WriteNull("error");
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    // The one entry point the host calls: never throws.
    public static string Run(byte[] bytes, string name, Settings settings)
    {
        try { return Write(name, Quantities.Run(bytes, settings)); }
        catch (DwgFileException ex) { return Error(name, ex.Reason, ex.Message); }
        catch (Exception ex) { return Error(name, "engine", ex.GetType().Name + ": " + ex.Message); }   // not the file's fault as far as we know
    }
}
