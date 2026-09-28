using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

// The page's example drawing (spec §5): a synthetic 12 × 9 m apartment in millimetres, built for the tool with
// no customer data. It shows every table: walls, hatched floors with a column island, water pipes with a bend,
// air ducts, doors and windows with attributes (one a dynamic block's anonymous copy), a bathroom block with
// nested fittings, and an arrayed insert of ceiling lights. Set DWGQ_WRITE_EXAMPLE=1 once to write
// js/dwg/examples/example-plan.dwg; the committed file is then the reference.
public class Examples
{
    static readonly string File = Path.Combine(Cad.Root(), "js", "dwg", "examples", "example-plan.dwg");

    public static CadDocument Plan()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        Cad.Layer(doc, "ΤΟΙΧΟΙ", 7); Cad.Layer(doc, "ΔΑΠΕΔΑ", 8); Cad.Layer(doc, "ΥΔΡΕΥΣΗ", 5); Cad.Layer(doc, "ΑΕΡΑΓΩΓΟΙ", 4);
        Cad.Layer(doc, "ΚΟΥΦΩΜΑΤΑ", 3); Cad.Layer(doc, "ΥΓΙΕΙΝΗ", 6); Cad.Layer(doc, "ΦΩΤΙΣΜΟΣ", 2); Cad.Layer(doc, "ΚΕΙΜΕΝΑ", 7);
        BlockRecord B(string name, params Entity[] es) { var b = new BlockRecord(name); foreach (var e in es) b.Entities.Add(e); doc.BlockRecords.Add(b); return b; }

        // Rooms: living room, bedroom, kitchen, bathroom (outer walls 12 × 9 m).
        (string Name, double X, double Y, double W, double H)[] rooms =
        {
            ("ΣΑΛΟΝΙ", 0, 0, 7000, 5000), ("ΥΠΝΟΔΩΜΑΤΙΟ", 7000, 0, 5000, 5000), ("ΚΟΥΖΙΝΑ", 0, 5000, 7000, 4000), ("ΛΟΥΤΡΟ", 7000, 5000, 5000, 4000),
        };
        foreach (var r in rooms)
        {
            doc.Entities.Add(Cad.Rect(r.X, r.Y, r.W, r.H).On(doc, "ΤΟΙΧΟΙ"));
            var h = new Hatch { IsSolid = false, Pattern = new HatchPattern("ANSI31"), PatternScale = 50 };
            var outer = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External | BoundaryPathFlags.Polyline };
            outer.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(r.X, r.Y, 0), new XYZ(r.X + r.W, r.Y, 0), new XYZ(r.X + r.W, r.Y + r.H, 0), new XYZ(r.X, r.Y + r.H, 0) } });
            h.Paths.Add(outer);
            if (r.Name == "ΣΑΛΟΝΙ")
            {
                var column = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline };
                column.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(3300, 2300, 0), new XYZ(3700, 2300, 0), new XYZ(3700, 2700, 0), new XYZ(3300, 2700, 0) } });
                h.Paths.Add(column);
                doc.Entities.Add(Cad.Rect(3300, 2300, 400, 400).On(doc, "ΤΟΙΧΟΙ"));
            }
            doc.Entities.Add(h.On(doc, "ΔΑΠΕΔΑ"));
            doc.Entities.Add(new TextEntity { Value = r.Name, Height = 250, InsertPoint = new XYZ(r.X + 400, r.Y + r.H - 600, 0) }.On(doc, "ΚΕΙΜΕΝΑ"));
        }

        // Water: a supply run with a rounded bend into the kitchen and the bathroom.
        doc.Entities.Add(Cad.Poly(false, (500, 8600, 0), (6000, 8600, 0), (6500, 8100, 0), (6500, 6000, 0)).On(doc, "ΥΔΡΕΥΣΗ"));
        doc.Entities.Add(Cad.Poly(false, (6500, 6000, 0), (9000, 6000, -0.4142135623730950), (9500, 6500, 0), (9500, 8500, 0)).On(doc, "ΥΔΡΕΥΣΗ"));
        // Air: two duct runs along the ceiling.
        doc.Entities.Add(Cad.Line(500, 4600, 11500, 4600).On(doc, "ΑΕΡΑΓΩΓΟΙ"));
        doc.Entities.Add(Cad.Line(3500, 4600, 3500, 500).On(doc, "ΑΕΡΑΓΩΓΟΙ"));
        doc.Entities.Add(new Circle { Center = new XYZ(3500, 500, 0), Radius = 150 }.On(doc, "ΑΕΡΑΓΩΓΟΙ"));

        // Doors and windows with attributes.
        var door = B("ΠΟΡΤΑ", Cad.Line(0, 0, 900, 0), new Arc { Center = new XYZ(0, 0, 0), Radius = 900, StartAngle = 0, EndAngle = Math.PI / 2 });
        var window = B("ΠΑΡΑΘΥΡΟ", Cad.Rect(0, -100, 1200, 200), Cad.Line(0, 0, 1200, 0));
        var wide = B("*U4", Cad.Rect(0, -100, 1800, 200), Cad.Line(0, 0, 1800, 0));                     // a stretched copy of the dynamic window
        var app = new AppId("AcDbBlockRepBTag"); doc.AppIds.Add(app);
        wide.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));
        void Place(BlockRecord b, double x, double y, double rot, string type, string w, string h)
        {
            var i = new Insert(b) { InsertPoint = new XYZ(x, y, 0), Rotation = rot }.On(doc, "ΚΟΥΦΩΜΑΤΑ");
            i.Attributes.Add(new AttributeEntity { Tag = "ΤΥΠΟΣ", Value = type });
            i.Attributes.Add(new AttributeEntity { Tag = "ΠΛΑΤΟΣ", Value = w });
            i.Attributes.Add(new AttributeEntity { Tag = "ΥΨΟΣ", Value = h });
            doc.Entities.Add(i);
        }
        Place(window, 1500, 0, 0, "Π1", "120", "140"); Place(window, 4000, 0, 0, "Π1", "120", "140");
        Place(window, 8500, 0, 0, "Π1", "120", "140"); Place(window, 12000, 6000, Math.PI / 2, "Π1", "120", "140");
        Place(wide, 1500, 9000, 0, "Π2", "180", "140");
        Place(door, 7000, 1000, Math.PI / 2, "Θ1", "90", "220"); Place(door, 6000, 5000, 0, "Θ1", "90", "220");
        Place(door, 8000, 5000, 0, "Θ2", "80", "220");

        // A bathroom set with nested fittings, and the ceiling lights as one arrayed insert.
        var wc = B("ΛΕΚΑΝΗ", Cad.Rect(0, 0, 400, 600));
        var basin = B("ΝΙΠΤΗΡΑΣ", new Ellipse { Center = new XYZ(250, 200, 0), MajorAxisEndPoint = new XYZ(250, 0, 0), RadiusRatio = 0.7, StartParameter = 0, EndParameter = 2 * Math.PI });
        var set = B("ΣΕΤ ΛΟΥΤΡΟΥ", new Insert(wc) { InsertPoint = new XYZ(0, 0, 0) }, new Insert(basin) { InsertPoint = new XYZ(800, 0, 0) }, Cad.Rect(1600, 0, 1700, 750));
        doc.Entities.Add(new Insert(set) { InsertPoint = new XYZ(11700, 8850, 0), Rotation = Math.PI }.On(doc, "ΥΓΙΕΙΝΗ"));
        var lamp = B("ΦΩΤΙΣΤΙΚΟ", new Circle { Center = new XYZ(0, 0, 0), Radius = 150 }, Cad.Line(-150, 0, 150, 0), Cad.Line(0, -150, 0, 150));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(1500, 1500, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2000, ColumnSpacing = 2000 }.On(doc, "ΦΩΤΙΣΜΟΣ"));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(9500, 2500, 0) }.On(doc, "ΦΩΤΙΣΜΟΣ"));
        return doc;
    }

    [Fact]
    public void The_example_plan_shows_every_table()
    {
        if (Environment.GetEnvironmentVariable("DWGQ_WRITE_EXAMPLE") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(File));
            System.IO.File.WriteAllBytes(File, Cad.Bytes(Plan(), true));
        }
        var r = Quantities.Run(System.IO.File.ReadAllBytes(File), new Settings());
        Assert.Equal("mm", r.Units);
        Assert.Equal(24 + 20 + 22 + 18 + 1.6, r.Layer("ΤΟΙΧΟΙ").Len, 6);                                   // 4 rooms + the column
        Assert.Equal(108.16, r.Layer("ΤΟΙΧΟΙ").Area, 6);
        Assert.Equal(108 - 0.16, r.Layer("ΔΑΠΕΔΑ").HatchArea, 6);                                          // floors minus the column
        Assert.Equal(4, r.Layer("ΔΑΠΕΔΑ").HatchCount);
        Assert.Equal(5, r.Blocks.Where(b => b.Name == "ΠΑΡΑΘΥΡΟ").Sum(b => b.Count));                     // four windows and the stretched one
        Assert.Equal(7, r.Blocks.Where(b => b.Name == "ΦΩΤΙΣΤΙΚΟ").Sum(b => b.Count));                     // an array of 6 and one more
        Assert.Equal(1, r.Blocks.Single(b => b.Name == "ΛΕΚΑΝΗ").Nested);
        Assert.Equal("ΥΓΙΕΙΝΗ", r.Blocks.Single(b => b.Name == "ΛΕΚΑΝΗ").Layer);
        Assert.Equal(2, r.Schedules.Count);
        Assert.Equal(4, r.Schedules.Single(s => s.Block == "ΠΑΡΑΘΥΡΟ").Rows.Single(x => x.Values[0] == "Π1").Count);
        Assert.Equal(4, r.NotMeasured.Text);
        Assert.DoesNotContain(r.Warnings, w => w.Id == "units-assumed");
    }
}
