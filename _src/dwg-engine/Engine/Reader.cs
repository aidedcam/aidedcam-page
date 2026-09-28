using ACadSharp;
using ACadSharp.Types.Units;

namespace AidedCam.Dwg;

// Opens a DWG or DXF file with ACadSharp and works out its units (spec §3, §4).
public static class Reader
{
    public static CadDocument Open(byte[] bytes, Result r)
    {
        if (bytes.Length > Limits.MaxBytes) throw new DwgFileException("limit", "over 30 MB");
        string head = System.Text.Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
        CadDocument doc;
        try
        {
            if (head.StartsWith("AC10"))
            {
                r.Format = "dwg";
                r.Version = VersionName(head.Substring(0, 6));
                if (r.Version == "") throw new DwgFileException("version", $"DWG version {head.Substring(0, 6)} is not supported");
                doc = ACadSharp.IO.DwgReader.Read(new MemoryStream(bytes));
            }
            else if (head.StartsWith("AutoCAD Binary DXF") || head.Contains("SECTION"))
            {
                r.Format = "dxf";
                doc = ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes));
                r.Version = VersionName(doc.Header.VersionString ?? "");
            }
            else throw new DwgFileException("read", "not a DWG or DXF file");
        }
        catch (DwgFileException) { throw; }
        catch (Exception ex) when (ex.GetType().Name.Contains("NotSupported")) { throw new DwgFileException("version", ex.Message); }
        catch (Exception ex) { throw new DwgFileException("read", ex.Message); }
        return doc;
    }

    public static string VersionName(string ac) => ac switch
    {
        "AC1009" => "R12", "AC1012" => "R13", "AC1014" => "R14", "AC1015" => "2000", "AC1018" => "2004",
        "AC1021" => "2007", "AC1024" => "2010", "AC1027" => "2013", "AC1032" => "2018", _ => "",
    };

    // Metres per drawing unit. A file's own units win over the setting, which applies only to files that state
    // none (spec §4); without a setting such a file is assumed to be in millimetres. Building drawings often
    // state the wrong units (a template in mm, drawn in cm), so the visitor can correct one file: the override
    // wins over everything.
    public static double Scale(CadDocument doc, Settings s, Result r)
    {
        (string name, double k) = doc.Header.InsUnits switch
        {
            UnitsType.Millimeters => ("mm", 0.001),
            UnitsType.Centimeters => ("cm", 0.01),
            UnitsType.Decimeters => ("dm", 0.1),
            UnitsType.Meters => ("m", 1.0),
            UnitsType.Kilometers => ("km", 1000.0),
            UnitsType.Inches => ("inch", 0.0254),
            UnitsType.Feet => ("ft", 0.3048),
            UnitsType.USSurveyFeet => ("ft", 1200.0 / 3937.0),
            UnitsType.Yards => ("yd", 0.9144),
            _ => ("none", 0.0),
        };
        r.Units = name;
        double over = Metres(s.Override);
        if (over > 0) { r.UnitsSource = "override"; r.Used = s.Override; return over; }
        if (name != "none") { r.UnitsSource = "file"; r.Used = name; return k; }
        double set = Metres(s.Units);
        if (set > 0) { r.UnitsSource = "setting"; r.Used = s.Units; return set; }
        r.UnitsSource = "assumed";
        r.Used = "mm";
        return 0.001;
    }

    static double Metres(string unit) => unit switch { "mm" => 0.001, "cm" => 0.01, "m" => 1.0, "inch" => 0.0254, "ft" => 0.3048, _ => 0.0 };
}
