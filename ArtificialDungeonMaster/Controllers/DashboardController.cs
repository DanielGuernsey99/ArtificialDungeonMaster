using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArtificialDungeonMaster.Controllers
{
    [Authorize]
    public class DashboardController : Controller
    {
        [HttpGet("/Dashboard")]
        public IActionResult Index() => View();
    }
}
