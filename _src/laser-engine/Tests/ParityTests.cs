using Xunit;

namespace AidedCam.Laser.Tests;

// The committed parity fixtures must match what this engine produces. After a deliberate engine change,
// regenerate them with:  LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests
public class ParityTests
{
    static string Dir([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here), "..", "..", "..", "_tests", "laser", "fixtures"));

    [Fact]
    public void Committed_fixtures_and_expected_results_are_current()
    {
        var dir = Dir();
        var files = Fixtures.All();
        string expected = Fixtures.ExpectedJson().Replace("\r\n", "\n");
        if (Environment.GetEnvironmentVariable("LASER_WRITE_FIXTURES") == "1")
        {
            Fixtures.WriteChanged(dir, files);
            File.WriteAllText(Path.Combine(dir, "expected.json"), expected + "\n");
        }
        foreach (var (name, bytes) in files)
        {
            var path = Path.Combine(dir, name);
            Assert.True(File.Exists(path), $"missing fixture {name}");
            Assert.True(Fixtures.SameResult(File.ReadAllBytes(path), bytes), $"fixture {name} is stale");
        }
        Assert.Equal(expected, File.ReadAllText(Path.Combine(dir, "expected.json")).Replace("\r\n", "\n").TrimEnd('\n'));
    }

    [Fact]
    public void The_fixtures_cover_the_risky_cases()
    {
        var s = Fixtures.All().ToDictionary(kv => kv.Key, kv => Processor.Process(kv.Value, new Settings()));
        Assert.Equal(4, s["plate-holes.dxf"].Parts[0].Holes.Count);
        Assert.Equal(2, s["gaps.dxf"].Stats.GapsClosed);
        Assert.Equal(2, s["nested.dxf"].Parts.Count);
        Assert.Single(s["slot-bulge.dxf"].Parts[0].Holes);
        Assert.Contains(s["roles-text.dxf"].Checks, c => c.Id == "duplicates-removed");
        Assert.Equal("ΤΕΜ. 1", Assert.Single(s["roles-text.dxf"].Drawing.Texts).Value);
        Assert.Contains(s["open.dxf"].Checks, c => c.Id == "open-path");
        Assert.Equal(2, s["blocks-2004.dxf"].Parts[0].Holes.Count);
        Assert.Equal(2, s["blocks.dwg"].Parts[0].Holes.Count);
        Assert.Equal(6, s["array-2004.dxf"].Parts[0].Holes.Count);
        Assert.Equal(6, s["array.dwg"].Parts[0].Holes.Count);
        var curves = s["curves-2004.dxf"];
        Assert.Single(curves.Parts);                                       // the ellipse, as lines within 0.01 mm
        Assert.True(curves.MarkLength > 60, $"spline mark length {curves.MarkLength}");
    }
}
