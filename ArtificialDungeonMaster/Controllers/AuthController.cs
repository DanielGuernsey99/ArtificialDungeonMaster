// /Controllers/AuthController.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using ArtificialDungeonMaster.Data.Models;
using ArtificialDungeonMaster.Data.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;

namespace ArtificialDungeonMaster.Controllers
{
    public class AuthController : Controller
    {
        private readonly UserManager<AppUser> _users;
        private readonly SignInManager<AppUser> _signIn;
        private readonly IEmailSenderService _emailSenderService;

        public AuthController(UserManager<AppUser> users, SignInManager<AppUser> signIn, IEmailSenderService email)
        {
            _users = users;
            _signIn = signIn;
            _emailSenderService = email;
        }


        // -------------------- EMAIL/PASSWORD SIGN IN --------------------
        // POST /auth/login
        [HttpPost("/auth/login")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login([FromForm] LoginVm input, [FromQuery] string? returnUrl)
        {
            returnUrl ??= "/Dashboard";
            if (!ModelState.IsValid)
            {
                TempData["LoginError"] = "Please correct the errors and try again.";
                return RedirectToAction("Splash", "Home", new { showLogin = true });
            }

            // try email first, then username
            var user = await _users.FindByEmailAsync(input.EmailOrUsername)
                   ?? await _users.FindByNameAsync(input.EmailOrUsername);

            if (user is null)
            {
                TempData["LoginError"] = "Invalid username/email or password.";
                return RedirectToAction("Splash", "Home", new { showLogin = true });
            }

            var result = await _signIn.PasswordSignInAsync(
                userName: user.UserName,       // always pass Identity username
                password: input.Password,
                isPersistent: input.RememberMe,
                lockoutOnFailure: true);

            if (result.Succeeded) return LocalRedirect(returnUrl);

            TempData["LoginError"] = result.IsNotAllowed ? "Please confirm your account before signing in."
                                 : result.IsLockedOut ? "Your account is locked. Try again later."
                                 : "Invalid username/email or password.";
            return RedirectToAction("Splash", "Home", new { showLogin = true });
        }

        public class LoginVm
        {
            [Required]                            // remove [EmailAddress]
            public string EmailOrUsername { get; set; } = string.Empty;

            [System.ComponentModel.DataAnnotations.Required]
            public string Password { get; set; } = string.Empty;

            public bool RememberMe { get; set; }
        }

        // -------------------- EMAIL/PASSWORD REGISTER --------------------
        // POST /auth/register
        [HttpPost("/auth/register")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register([FromForm] RegisterVm input, [FromQuery] string? returnUrl)
        {
            returnUrl ??= "/Dashboard";

            // Normalize simple whitespace
            input.UserName = input.UserName?.Trim() ?? "";
            input.Email = input.Email?.Trim() ?? "";

            if (!ModelState.IsValid)
            {
                TempData["RegisterError"] = "Please fix the errors and try again.";
                return RedirectToAction("Splash", "Home", new { showRegister = true });
            }

            if (!string.Equals(input.Password, input.ConfirmPassword, StringComparison.Ordinal))
            {
                TempData["RegisterError"] = "Passwords do not match.";
                return RedirectToAction("Splash", "Home", new { showRegister = true });
            }

            // Uniqueness checks
            if (await _users.FindByNameAsync(input.UserName) is not null)
            {
                TempData["RegisterError"] = "That username is already taken.";
                return RedirectToAction("Splash", "Home", new { showRegister = true });
            }
            if (await _users.FindByEmailAsync(input.Email) is not null)
            {
                TempData["RegisterError"] = "An account with that email already exists.";
                return RedirectToAction("Splash", "Home", new { showRegister = true });
            }

            var user = new AppUser
            {
                UserName = input.UserName,   // store the handle in Identity's UserName column
                Email = input.Email,
                EmailConfirmed = false
            };

            var create = await _users.CreateAsync(user, input.Password);
            if (!create.Succeeded)
            {
                TempData["RegisterError"] = string.Join(" ", create.Errors.Select(e => e.Description));
                return RedirectToAction("Splash", "Home", new { showRegister = true });
            }

            // Email confirmation
            var token = await _users.GenerateEmailConfirmationTokenAsync(user);
            var tokenBytes = System.Text.Encoding.UTF8.GetBytes(token);
            var tokenEncoded = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(tokenBytes);

            var confirmLink = Url.Action(
                action: nameof(ConfirmEmail),
                controller: "Auth",
                values: new { userId = user.Id, token = tokenEncoded },
                protocol: Request.Scheme)!;

            var body = $@"
      <div style='font-family:Segoe UI,Arial,sans-serif;font-size:16px'>
        <p>Welcome to <strong>Loremaster AI</strong>!</p>
        <p>Confirm your email by clicking
           <a href=""{System.Net.WebUtility.HtmlEncode(confirmLink)}"">this link</a>.</p>
        <p style='font-size:13px;color:#666'>If you didn’t sign up, you can ignore this email.</p>
      </div>";

            await _emailSenderService.SendAsync(user.Email, "Confirm your email", body);

            TempData["LoginError"] = "We sent a confirmation link. (Dev: click the button below to confirm.)";
            TempData["DevConfirmLink"] = confirmLink;

            return RedirectToAction("Splash", "Home", new { showLogin = true });
        }


        // GET /auth/confirmemail?userId=...&token=...
        [HttpGet("/auth/confirmemail")]
        public async Task<IActionResult> ConfirmEmail(Guid userId, string token)
        {
            var user = await _users.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                TempData["LoginError"] = "Invalid confirmation request.";
                return RedirectToAction("Splash", "Home", new { showLogin = true });
            }

            // decode the Base64Url token
            var decodedBytes = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(token);
            var decodedToken = System.Text.Encoding.UTF8.GetString(decodedBytes);

            var result = await _users.ConfirmEmailAsync(user, decodedToken);
            if (result.Succeeded)
            {
                TempData["LoginMessage"] = "Your email has been confirmed. Please sign in.";
                return RedirectToAction("Splash", "Home", new { showLogin = true });
            }

            TempData["LoginError"] = "Email confirmation failed.";
            return RedirectToAction("Splash", "Home", new { showLogin = true });
        }

        public class RegisterVm
        {
            [Required]
            [RegularExpression("^[a-zA-Z0-9_]{3,20}$",
             ErrorMessage = "Username must be 3–20 characters, letters/numbers/underscores only.")]
            public string UserName { get; set; } = string.Empty;

            [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.EmailAddress]
            public string Email { get; set; } = string.Empty;

            [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.MinLength(6)]
            public string Password { get; set; } = string.Empty;

            [System.ComponentModel.DataAnnotations.Required]
            public string ConfirmPassword { get; set; } = string.Empty;
        }

        // -------------------- WINDOWS SSO --------------------
        // GET /auth/windows
        [HttpGet("/auth/windows")]
        public IActionResult Windows(string? returnUrl = null)
        {
            var target = string.IsNullOrWhiteSpace(returnUrl) ? "/Dashboard" : returnUrl;
            return Challenge(new AuthenticationProperties { RedirectUri = target, IsPersistent = true },
                             NegotiateDefaults.AuthenticationScheme);
        }
    }
}
