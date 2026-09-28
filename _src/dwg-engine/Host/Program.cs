using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using AidedCam.Dwg;

// The engine starts with the worker; there is nothing to do until a file arrives.
Console.WriteLine("dwg quantities engine ready");

public static partial class Api
{
    // One file in, the result JSON out (spec §3 contract). Never throws: a refused file is an error result.
    [JSExport]
    public static string Quantities(byte[] bytes, string name, string settingsJson) =>
        ResultJson.Run(bytes, name, ParseSettings(settingsJson));

    static Settings ParseSettings(string json)
    {
        var s = new Settings();
        if (string.IsNullOrWhiteSpace(json)) return s;
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("units", out var u) && u.ValueKind == JsonValueKind.String) s.Units = u.GetString();
        if (doc.RootElement.TryGetProperty("override", out var o) && o.ValueKind == JsonValueKind.String) s.Override = o.GetString();
        return s;
    }
}
