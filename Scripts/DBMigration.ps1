dotnet tool restore

$project = "..\ArtificialDungeonMaster.Data\ArtificialDungeonMaster.Data.csproj"
$startup = "..\ArtificialDungeonMaster\ArtificialDungeonMaster.csproj"

dotnet ef database update --project $project --startup-project $startup