using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using CSMath;

namespace AidedCam.Dwg.Tests;

// Synthetic drawings for the tests, written with ACadSharp (the library the engine reads with), so every
// expected number is known exactly.
public static class Cad
{
    // Walks up from AppContext.BaseDirectory to the folder holding free-tools.html.
    public static string Root()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "free-tools.html"))) d = d.Parent;
        return d?.FullName ?? throw new InvalidOperationException("repo root not found");
    }

    public static CadDocument Doc(UnitsType units = UnitsType.Millimeters, ACadVersion version = ACadVersion.AC1032)
    {
        var doc = new CadDocument(version);
        doc.Header.InsUnits = units;
        return doc;
    }

    public static Layer Layer(CadDocument doc, string name, short aci = 7)
    {
        if (doc.Layers.TryGetValue(name, out Layer l)) return l;
        l = new Layer(name) { Color = new Color(aci) };
        doc.Layers.Add(l);
        return l;
    }

    public static T On<T>(this T e, CadDocument doc, string layer) where T : Entity { e.Layer = Layer(doc, layer); return e; }

    public static Line Line(double x0, double y0, double x1, double y1) => new() { StartPoint = new XYZ(x0, y0, 0), EndPoint = new XYZ(x1, y1, 0) };

    public static LwPolyline Poly(bool closed, params (double X, double Y, double Bulge)[] v)
    {
        var p = new LwPolyline { IsClosed = closed };
        foreach (var (x, y, b) in v) p.Vertices.Add(new LwPolyline.Vertex(new XY(x, y)) { Bulge = b });
        return p;
    }

    public static LwPolyline Rect(double x, double y, double w, double h) => Poly(true, (x, y, 0), (x + w, y, 0), (x + w, y + h, 0), (x, y + h, 0));

    public static byte[] Bytes(CadDocument doc, bool dwg)
    {
        var ms = new MemoryStream();
        if (dwg) { using var w = new ACadSharp.IO.DwgWriter(ms, doc); w.Write(); }
        else { using var w = new ACadSharp.IO.DxfWriter(ms, doc, false); w.Write(); }
        return ms.ToArray();
    }

    public static Result Run(CadDocument doc, bool dwg = true, string units = "auto") =>
        Quantities.Run(Bytes(doc, dwg), new Settings { Units = units });

    public static LayerTotal Layer(this Result r, string name) => r.Layers.Single(l => l.Name == name);
}
