using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArtificialDungeonMaster.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet("account/login")]
        public IActionResult Login(string? returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl ?? "/";
            return View();
        }

        [HttpGet("account/external")]
        public IActionResult External(string provider, string? returnUrl = null)
        {
            var redirectUrl = Url.Action("PostSignIn", "Account", new { returnUrl });
            var props = new AuthenticationProperties { RedirectUri = redirectUrl };
            return Challenge(props, provider);
        }

        [HttpGet]
        public IActionResult PostSignIn(string? returnUrl = null)
        {
            // You can inspect User.Claims here or create a local user record.
            return Redirect(returnUrl ?? "/");
        }

        [Authorize]
        [HttpPost("account/logout")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Splash", "Home");
        }

        [HttpGet("account/access-denied")]
        public IActionResult AccessDenied() => View();
    }
}
