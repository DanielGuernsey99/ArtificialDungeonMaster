using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ArtificialDungeonMaster.Data.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ArtificialDungeonMaster.Areas.Identity.Pages.Account
{
    public class ExternalLoginModel : PageModel
    {
        private readonly SignInManager<AppUser> _signInManager;
        private readonly UserManager<AppUser> _userManager;

        public ExternalLoginModel(SignInManager<AppUser> signInManager, UserManager<AppUser> userManager)
        {
            _signInManager = signInManager;
            _userManager = userManager;
        }

        [BindProperty] public InputModel Input { get; set; } = new();

        public string? ReturnUrl { get; set; }
        public string? ProviderDisplayName { get; set; }

        public class InputModel
        {
            [Required]
            [Display(Name = "Username")]
            [RegularExpression("^[a-zA-Z0-9_]{3,20}$",
                ErrorMessage = "3–20 chars. Letters, numbers, underscores only.")]
            public string UserName { get; set; } = string.Empty;

            [Required, EmailAddress]
            [Display(Name = "Email")]
            public string Email { get; set; } = string.Empty;
        }

        public IActionResult OnGet() => RedirectToPage("./Login");

        public IActionResult OnPost(string provider, string returnUrl = null!)
        {
            var redirectUrl = Url.Page("./ExternalLogin", pageHandler: "Callback", values: new { returnUrl });
            var props = _signInManager.ConfigureExternalAuthenticationProperties(provider, redirectUrl);
            return new ChallengeResult(provider, props);
        }

        public async Task<IActionResult> OnGetCallbackAsync(string returnUrl = null!, string remoteError = null!)
        {
            returnUrl ??= Url.Content("~/");
            ReturnUrl = returnUrl;

            if (remoteError != null)
            {
                ModelState.AddModelError(string.Empty, $"Error from external provider: {remoteError}");
                return Page();
            }

            var info = await _signInManager.GetExternalLoginInfoAsync();
            if (info == null) return RedirectToPage("./Login");

            // Existing external user? Sign in.
            var result = await _signInManager.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: true);
            if (result.Succeeded) return LocalRedirect(returnUrl);

            // New user: ask for username + email
            ProviderDisplayName = info.ProviderDisplayName;

            var email = info.Principal.FindFirstValue(ClaimTypes.Email) ?? "";
            Input.Email = email;

            // Suggest username from email local part
            var suggested = email.Contains('@') ? email.Split('@')[0] : "user";
            // Keep only allowed chars
            suggested = System.Text.RegularExpressions.Regex.Replace(suggested, @"[^a-zA-Z0-9_]", "");
            if (string.IsNullOrWhiteSpace(suggested)) suggested = "user";
            Input.UserName = suggested;

            return Page();
        }

        public async Task<IActionResult> OnPostConfirmationAsync(string returnUrl = null!)
        {
            returnUrl ??= Url.Content("~/");
            ReturnUrl = returnUrl;

            var info = await _signInManager.GetExternalLoginInfoAsync();
            if (info == null) return RedirectToPage("./Login");

            if (!ModelState.IsValid) return Page();

            // Uniqueness checks
            if (await _userManager.FindByNameAsync(Input.UserName) != null)
            {
                ModelState.AddModelError("Input.UserName", "That username is already taken.");
                return Page();
            }
            if (await _userManager.FindByEmailAsync(Input.Email) != null)
            {
                ModelState.AddModelError("Input.Email", "An account with that email already exists.");
                return Page();
            }

            var user = new AppUser
            {
                UserName = Input.UserName,
                Email = Input.Email,
                EmailConfirmed = true // external provider is trusted; change if you want re‑confirmation
            };

            var create = await _userManager.CreateAsync(user);
            if (!create.Succeeded)
            {
                foreach (var e in create.Errors) ModelState.AddModelError(string.Empty, e.Description);
                return Page();
            }

            var addLogin = await _userManager.AddLoginAsync(user, info);
            if (!addLogin.Succeeded)
            {
                foreach (var e in addLogin.Errors) ModelState.AddModelError(string.Empty, e.Description);
                return Page();
            }

            await _signInManager.SignInAsync(user, isPersistent: true);
            return LocalRedirect(returnUrl);
        }
    }
}
