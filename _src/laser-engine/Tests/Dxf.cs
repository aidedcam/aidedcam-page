using System.Globalization;
using System.Text;

namespace AidedCam.Laser.Tests;

// Builds small synthetic R12 DXF files for the tests. No customer file is ever used.
public sealed class Dxf
{
    readonly List<(string name, int aci, string lt)> layers = new() { ("0", 7, "CONTINUOUS") };
    readonly StringBuilder blocks = new(), ents = new();
    string codePage;

    static string N(double v) => v.ToString("0.0#########", CultureInfo.InvariantCulture);
    static void G(StringBuilder sb, int code, string v) => sb.Append(code).Append("\r\n").Append(v).Append("\r\n");

    public Dxf Layer(string name, int aci = 7, string lineType = "CONTINUOUS") { layers.Add((name, aci, lineType)); return this; }
    public Dxf CodePage(string cp) { codePage = cp; return this; }

    static void Common(StringBuilder sb, string layer, int? aci)
    {
        G(sb, 8, layer);
        if (aci.HasValue) G(sb, 62, aci.Value.ToString(CultureInfo.InvariantCulture));
    }

    public Dxf Line(double x1, double y1, double x2, double y2, string layer = "0", int? aci = null) => To(ents, sb =>
    {
        G(sb, 0, "LINE"); Common(sb, layer, aci);
        G(sb, 10, N(x1)); G(sb, 20, N(y1)); G(sb, 30, "0"); G(sb, 11, N(x2)); G(sb, 21, N(y2)); G(sb, 31, "0");
    });

    // DXF arcs run counter-clockwise from a0 to a1 (degrees).
    public Dxf Arc(double cx, double cy, double r, double a0, double a1, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "ARC"); Common(sb, layer, null);
        G(sb, 10, N(cx)); G(sb, 20, N(cy)); G(sb, 30, "0"); G(sb, 40, N(r)); G(sb, 50, N(a0)); G(sb, 51, N(a1));
    });

    public Dxf Circle(double cx, double cy, double r, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "CIRCLE"); Common(sb, layer, null);
        G(sb, 10, N(cx)); G(sb, 20, N(cy)); G(sb, 30, "0"); G(sb, 40, N(r));
    });

    public Dxf Rect(double x, double y, double w, double h, string layer = "0") =>
        Line(x, y, x + w, y, layer).Line(x + w, y, x + w, y + h, layer).Line(x + w, y + h, x, y + h, layer).Line(x, y + h, x, y, layer);

    // Vertices (x, y, bulge); bulge belongs to the piece that starts at that vertex.
    public Dxf Polyline(bool closed, string layer, params (double x, double y, double b)[] v) => To(ents, sb =>
    {
        G(sb, 0, "POLYLINE"); Common(sb, layer, null); G(sb, 66, "1"); G(sb, 70, closed ? "1" : "0");
        G(sb, 10, "0"); G(sb, 20, "0"); G(sb, 30, "0");
        foreach (var (x, y, b) in v)
        {
            G(sb, 0, "VERTEX"); G(sb, 8, layer); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0");
            if (b != 0) G(sb, 42, N(b));
        }
        G(sb, 0, "SEQEND"); G(sb, 8, layer);
    });

    public Dxf Text(double x, double y, double h, string value, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "TEXT"); Common(sb, layer, null); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0"); G(sb, 40, N(h)); G(sb, 1, value);
    });

    public Dxf Block(string name, Action<Dxf> body)
    {
        var inner = new Dxf();
        body(inner);
        G(blocks, 0, "BLOCK"); G(blocks, 8, "0"); G(blocks, 2, name); G(blocks, 70, "0"); G(blocks, 10, "0"); G(blocks, 20, "0"); G(blocks, 30, "0");
        blocks.Append(inner.ents);
        G(blocks, 0, "ENDBLK"); G(blocks, 8, "0");
        return this;
    }

    public Dxf Insert(string block, double x, double y, double scale = 1, double rotation = 0, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "INSERT"); Common(sb, layer, null); G(sb, 2, block); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0");
        G(sb, 41, N(scale)); G(sb, 42, N(scale)); G(sb, 50, N(rotation));
    });

    Dxf To(StringBuilder sb, Action<StringBuilder> a) { a(sb); return this; }

    public byte[] Bytes()
    {
        var sb = new StringBuilder();
        G(sb, 0, "SECTION"); G(sb, 2, "HEADER"); G(sb, 9, "$ACADVER"); G(sb, 1, "AC1009");
        if (codePage != null) { G(sb, 9, "$DWGCODEPAGE"); G(sb, 3, codePage); }
        G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "TABLES");
        G(sb, 0, "TABLE"); G(sb, 2, "LTYPE"); G(sb, 70, "2");
        G(sb, 0, "LTYPE"); G(sb, 2, "CONTINUOUS"); G(sb, 70, "0"); G(sb, 3, "Solid"); G(sb, 72, "65"); G(sb, 73, "0"); G(sb, 40, "0");
        G(sb, 0, "LTYPE"); G(sb, 2, "DASHED"); G(sb, 70, "0"); G(sb, 3, "__ __"); G(sb, 72, "65"); G(sb, 73, "2"); G(sb, 40, "9"); G(sb, 49, "6"); G(sb, 49, "-3");
        G(sb, 0, "ENDTAB");
        G(sb, 0, "TABLE"); G(sb, 2, "LAYER"); G(sb, 70, layers.Count.ToString(CultureInfo.InvariantCulture));
        foreach (var (name, aci, lt) in layers) { G(sb, 0, "LAYER"); G(sb, 2, name); G(sb, 70, "0"); G(sb, 62, aci.ToString(CultureInfo.InvariantCulture)); G(sb, 6, lt); }
        G(sb, 0, "ENDTAB"); G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "BLOCKS"); sb.Append(blocks); G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "ENTITIES"); sb.Append(ents); G(sb, 0, "ENDSEC");
        G(sb, 0, "EOF");
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(codePage == "ANSI_1253" ? 1253 : 1252).GetBytes(sb.ToString());
    }
}

// DXF 2004+ and DWG files for the tests, written with ACadSharp, the library Eyeshot reads them with.
public static class AcadFile
{
    public static byte[] Write(ACadSharp.CadDocument doc, bool dwg)
    {
        var ms = new MemoryStream();
        if (dwg) { using var w = new ACadSharp.IO.DwgWriter(ms, doc); w.Write(); }
        else { using var w = new ACadSharp.IO.DxfWriter(ms, doc, false); w.Write(); }
        return ms.ToArray();
    }
}
