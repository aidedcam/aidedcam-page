using System.Globalization;
using System.Text;

namespace AidedCam.Laser;

// The repaired file (spec §10): AutoCAD R12 DXF, which every laser CAM reads.
// Each contour is one POLYLINE with bulge arcs (a lone circle stays a CIRCLE); text is TEXT on its own layer.
public static class DxfR12
{
    static readonly (string Name, int Aci, string LineType)[] Layers =
    {
        ("0", 7, "CONTINUOUS"), ("CUT", 7, "CONTINUOUS"), ("MARK", 5, "CONTINUOUS"), ("BEND", 30, "DASHED"), ("TEXT", 8, "CONTINUOUS"),
    };

    public static byte[] Write(IEnumerable<Contour> contours, IEnumerable<TextItem> texts)
    {
        var sb = new StringBuilder();
        void G(int code, string v) { sb.Append(code.ToString(CultureInfo.InvariantCulture).PadLeft(3)).Append("\r\n").Append(v).Append("\r\n"); }
        void N(int code, double v) => G(code, v.ToString("0.0#########", CultureInfo.InvariantCulture));

        var list = contours.Where(c => c.Role != Roles.Ignore && c.Segs.Count > 0).ToList();
        var textList = texts.ToList();
        double x0 = 0, y0 = 0, x1 = 0, y1 = 0; bool any = false;
        foreach (var c in list)
        {
            var (mn, mx) = Chains.Bounds(c);
            if (!any) { x0 = mn.X; y0 = mn.Y; x1 = mx.X; y1 = mx.Y; any = true; }
            else { x0 = Math.Min(x0, mn.X); y0 = Math.Min(y0, mn.Y); x1 = Math.Max(x1, mx.X); y1 = Math.Max(y1, mx.Y); }
        }

        G(0, "SECTION"); G(2, "HEADER");
        G(9, "$ACADVER"); G(1, "AC1009");
        G(9, "$DWGCODEPAGE"); G(3, "ANSI_1253");
        G(9, "$EXTMIN"); N(10, x0); N(20, y0); N(30, 0);
        G(9, "$EXTMAX"); N(10, x1); N(20, y1); N(30, 0);
        G(0, "ENDSEC");

        G(0, "SECTION"); G(2, "TABLES");
        G(0, "TABLE"); G(2, "LTYPE"); G(70, "2");
        G(0, "LTYPE"); G(2, "CONTINUOUS"); G(70, "0"); G(3, "Solid line"); G(72, "65"); G(73, "0"); N(40, 0);
        G(0, "LTYPE"); G(2, "DASHED"); G(70, "0"); G(3, "__ __ __"); G(72, "65"); G(73, "2"); N(40, 9); N(49, 6); N(49, -3);
        G(0, "ENDTAB");
        G(0, "TABLE"); G(2, "LAYER"); G(70, Layers.Length.ToString(CultureInfo.InvariantCulture));
        foreach (var (name, aci, lt) in Layers) { G(0, "LAYER"); G(2, name); G(70, "0"); G(62, aci.ToString(CultureInfo.InvariantCulture)); G(6, lt); }
        G(0, "ENDTAB");
        G(0, "ENDSEC");

        G(0, "SECTION"); G(2, "ENTITIES");
        foreach (var c in list)
        {
            string layer = c.Role == Roles.Mark ? "MARK" : c.Role == Roles.Bend ? "BEND" : "CUT";
            if (c.Segs.Count == 1 && c.Segs[0].Kind == SegKind.Circle)
            {
                var ci = c.Segs[0];
                G(0, "CIRCLE"); G(8, layer); N(10, ci.C.X); N(20, ci.C.Y); N(30, 0); N(40, ci.R);
                continue;
            }
            G(0, "POLYLINE"); G(8, layer); G(66, "1"); N(10, 0); N(20, 0); N(30, 0); G(70, c.Closed ? "1" : "0");
            foreach (var s in c.Segs)
            {
                G(0, "VERTEX"); G(8, layer); N(10, s.A.X); N(20, s.A.Y); N(30, 0);
                if (s.Kind == SegKind.Arc) N(42, s.Bulge);
            }
            if (!c.Closed)
            {
                var last = c.Segs[^1];
                G(0, "VERTEX"); G(8, layer); N(10, last.B.X); N(20, last.B.Y); N(30, 0);
            }
            G(0, "SEQEND"); G(8, layer);
        }
        foreach (var t in textList)
        {
            G(0, "TEXT"); G(8, "TEXT"); N(10, t.At.X); N(20, t.At.Y); N(30, 0); N(40, t.Height > 0 ? t.Height : 2.5);
            G(1, t.Value.Replace("\r", " ").Replace("\n", " "));
            if (Math.Abs(t.Rotation) > 1e-9) N(50, t.Rotation);
        }
        G(0, "ENDSEC");
        G(0, "EOF");

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var enc = Encoding.GetEncoding(1253, EncoderFallback.ReplacementFallback, DecoderFallback.ReplacementFallback);
        return enc.GetBytes(sb.ToString());
    }
}
