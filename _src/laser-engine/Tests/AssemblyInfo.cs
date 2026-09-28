// ACadSharp's writers (used to build fixtures) are not safe to run from parallel test classes,
// and the browser engine processes one file at a time anyway.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
