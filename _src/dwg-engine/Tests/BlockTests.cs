using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class BlockTests
{
    static BlockRecord Block(CadDocument doc, string name, params Entity[] entities)
    {
        var b = new BlockRecord(name);
        foreach (var e in entities) b.Entities.Add(e);
        doc.BlockRecords.Add(b);
        return b;
    }

    static Insert Place(BlockRecord b, double x, double y, CadDocument doc, string layer)
    {
        var i = new Insert(b) { InsertPoint = new XYZ(x, y, 0) };
        return i.On(doc, layer);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Inserts_are_counted_per_name_and_layer_and_their_geometry_is_not_added_to_layer_lengths(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var valve = Block(doc, "VALVE", Cad.Line(-0.1, 0, 0.1, 0), new Circle { Center = new XYZ(0, 0, 0), Radius = 0.05 });
        doc.Entities.Add(Cad.Line(0, 0, 10, 0).On(doc, "PIPE"));
        doc.Entities.Add(Place(valve, 2, 0, doc, "PIPE"));
        doc.Entities.Add(Place(valve, 6, 0, doc, "PIPE"));
        doc.Entities.Add(Place(valve, 0, 5, doc, "SPARE"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(10, r.Layer("PIPE").Len, 9);                                                      // the pipe only
        Assert.Equal(2, r.Blocks.Single(b => b.Name == "VALVE" && b.Layer == "PIPE").Count);
        Assert.Equal(1, r.Blocks.Single(b => b.Name == "VALVE" && b.Layer == "SPARE").Count);
        Assert.Equal(6, r.NotMeasured.InsideBlocks);                                                   // 2 curves × 3 inserts
        Assert.Contains(r.Warnings, w => w.Id == "inside-blocks");
        var item = r.Items.First(i => i.Kind == "insert");
        Assert.Equal("VALVE", item.Block);
        Assert.Equal(2, item.Path.Count);                                                              // drawn from the block's line and circle
        Assert.Equal(1.9, item.Path[0][0], 6);                                                         // placed at x = 2
    }

    [Fact]
    public void An_arrayed_insert_counts_rows_times_columns_and_draws_every_copy()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var lamp = Block(doc, "LAMP", new Circle { Center = new XYZ(0, 0, 0), Radius = 0.1 });
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(0, 0, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2, ColumnSpacing = 3 }.On(doc, "LIGHT"));
        var r = Cad.Run(doc);
        Assert.Equal(6, r.Blocks.Single().Count);
        Assert.Equal(6, r.Items.Single().Copies);
        Assert.Equal(6, r.Items.Single().Path.Count);
        Assert.Equal(6.1, r.X1, 4);                                                                     // the far column at x = 6
    }

    [Fact]
    public void Nested_inserts_are_counted_through_their_placements_and_take_the_parents_layer_from_layer_0()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var wc = Block(doc, "WC", Cad.Rect(0, 0, 0.4, 0.6));
        var bath = Block(doc, "BATHROOM", Cad.Rect(0, 0, 2, 3), new Insert(wc) { InsertPoint = new XYZ(0.2, 0.2, 0) }, new Insert(wc) { InsertPoint = new XYZ(1.2, 0.2, 0) });
        for (int i = 0; i < 3; i++) doc.Entities.Add(Place(bath, i * 5, 0, doc, "SANITARY"));
        var r = Cad.Run(doc);
        Assert.Equal(3, r.Blocks.Single(b => b.Name == "BATHROOM").Count);
        var nested = r.Blocks.Single(b => b.Name == "WC");
        Assert.Equal(0, nested.Count);
        Assert.Equal(6, nested.Nested);
        Assert.Equal("SANITARY", nested.Layer);
        Assert.Equal(3 * (1 + 2), r.NotMeasured.InsideBlocks);
        Assert.Equal(3, r.Items[0].Path.Count);                                                        // the room and its two WCs
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_dynamic_blocks_anonymous_copy_is_counted_under_the_name_users_see(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var window = Block(doc, "WINDOW", Cad.Line(0, 0, 1, 0));
        var copy = Block(doc, "*U12", Cad.Line(0, 0, 1.2, 0));
        var app = new AppId("AcDbBlockRepBTag");
        doc.AppIds.Add(app);
        copy.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));
        doc.Entities.Add(Place(window, 0, 0, doc, "WINDOWS"));
        doc.Entities.Add(Place(copy, 5, 0, doc, "WINDOWS"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(2, r.Blocks.Single().Count);
        Assert.Equal("WINDOW", r.Blocks.Single().Name);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Attributes_become_a_schedule_with_identical_rows_collapsed(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var window = Block(doc, "WINDOW", Cad.Rect(0, 0, 1, 0.2));
        void Add(double x, string type, string w, string h)
        {
            var i = Place(window, x, 0, doc, "WINDOWS");
            i.Attributes.Add(new AttributeEntity { Tag = "TYPE", Value = type });
            i.Attributes.Add(new AttributeEntity { Tag = "W", Value = w });
            i.Attributes.Add(new AttributeEntity { Tag = "H", Value = h });
            doc.Entities.Add(i);
        }
        for (int k = 0; k < 8; k++) Add(k * 2, "W1", "120", "140");
        Add(20, "W2", "80", "60"); Add(22, "W2", "80", "60");
        var r = Cad.Run(doc, dwg);
        var s = r.Schedules.Single();
        Assert.Equal("WINDOW", s.Block);
        Assert.Equal(new[] { "TYPE", "W", "H" }, s.Tags);
        Assert.Equal(2, s.Rows.Count);
        Assert.Equal(new[] { "W1", "120", "140" }, s.Rows[0].Values);
        Assert.Equal(8, s.Rows[0].Count);
        Assert.Equal(2, s.Rows[1].Count);
    }

    [Fact]
    public void A_blocks_base_point_is_honoured_when_it_is_drawn()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var b = Block(doc, "B", Cad.Line(5, 0, 6, 0));
        b.BlockEntity.BasePoint = new XYZ(5, 0, 0);
        doc.Entities.Add(Place(b, 10, 0, doc, "L"));
        var path = Cad.Run(doc).Items.Single().Path.Single();
        Assert.Equal(10, path[0], 9); Assert.Equal(11, path[2], 9);
    }

    [Fact]
    public void Xrefs_are_listed_not_loaded_and_not_counted_as_blocks()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var x = new BlockRecord("SITE-PLAN") { Flags = ACadSharp.Blocks.BlockTypeFlags.XRef };
        doc.BlockRecords.Add(x);
        doc.Entities.Add(new Insert(x) { InsertPoint = new XYZ(0, 0, 0) });
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "L"));
        var r = Quantities.Run(Cad.Bytes(doc, false), new Settings());
        Assert.Equal(new[] { "SITE-PLAN" }, r.Xrefs);
        Assert.Empty(r.Blocks);
        Assert.Contains(r.Warnings, w => w.Id == "xrefs");
    }
}
