using Microsoft.AspNetCore.Mvc;

namespace ArtificialDungeonMaster.Controllers
{
    public class LoginController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
