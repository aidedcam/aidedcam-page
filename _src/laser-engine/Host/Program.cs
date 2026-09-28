using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using AidedCam.Laser;

// The engine starts with the worker; there is nothing to do until a file arrives.
Console.WriteLine("laser engine ready");

public static partial class Api
{
    static byte[] lastDxf = Array.Empty<byte>();

    // One file in, the result JSON out (spec §3 contract). The repaired DXF is fetched with LastDxf().
    [JSExport]
    public static string Process(byte[] bytes, string name, string settingsJson)
    {
        lastDxf = Array.Empty<byte>();
        try
        {
            var r = Processor.Process(bytes, ParseSettings(settingsJson));
            lastDxf = r.Dxf;
            return ResultJson.Write(name, r);
        }
        catch (LaserFileException ex) { return ResultJson.Error(name, ex.Reason, ex.Message); }
        catch (Exception ex) { return ResultJson.Error(name, "read", ex.GetType().Name + ": " + ex.Message); }
    }

    [JSExport]
    public static byte[] LastDxf() => lastDxf;

    static Settings ParseSettings(string json)
    {
        var s = new Settings();
        if (string.IsNullOrWhiteSpace(json)) return s;
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.TryGetProperty("units", out var u) && u.ValueKind == JsonValueKind.String) s.Units = u.GetString();
        if (root.TryGetProperty("joinTol", out var j) && j.TryGetDouble(out var jv) && jv > 0) s.JoinTol = jv;
        if (root.TryGetProperty("gapTol", out var g) && g.TryGetDouble(out var gv) && gv >= 0) s.GapTol = gv;
        if (root.TryGetProperty("roles", out var roles) && roles.ValueKind == JsonValueKind.Object)
            foreach (var p in roles.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.String && Roles.IsRole(p.Value.GetString())) s.Roles[p.Name] = p.Value.GetString();
        return s;
    }
}
