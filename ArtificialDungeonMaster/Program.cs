using ArtificialDungeonMaster.Data.DBContext;
using ArtificialDungeonMaster.Data.Models;
using ArtificialDungeonMaster.Data.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;


var builder = WebApplication.CreateBuilder(args);


builder.Services.Configure<AzureEmailOptions>(builder.Configuration.GetSection("AzureEmail"));

#region Custom Services
builder.Services.AddTransient<IEmailSenderService, EmailSenderService>();
#endregion



builder.Services.AddDbContext<ApplicationDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services
    .AddIdentity<AppUser, IdentityRole<Guid>>(o =>
    {
        o.SignIn.RequireConfirmedAccount = false;
        o.User.RequireUniqueEmail = true;
        // optional cookie paths if you want custom URLs:
        // o.Cookies.ApplicationCookie.LoginPath = "/Identity/Account/Login";
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders()
    .AddDefaultUI(); // ← gives you /Identity/Account/Login etc.


builder.Services.Configure<IdentityOptions>(o =>
{
    o.SignIn.RequireConfirmedAccount = true; // forces confirmation before sign-in
});

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();   // ← required for Identity UI

// External providers (examples)
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = IdentityConstants.ApplicationScheme;
    options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
    options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
})
    .AddGoogle(opt =>
    {
        opt.ClientId = builder.Configuration["Auth:Google:ClientId"]!;
        opt.ClientSecret = builder.Configuration["Auth:Google:ClientSecret"]!;
        opt.CallbackPath = "/signin-google";
    })
    .AddMicrosoftAccount(opt =>
    {
        opt.ClientId = builder.Configuration["Auth:MicrosoftAccount:ClientId"]!;
        opt.ClientSecret = builder.Configuration["Auth:MicrosoftAccount:ClientSecret"]!;
    });

var app = builder.Build();

//REMOVE APP USERS ON STARTUP
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    db.Users.RemoveRange(db.Users);
    db.SaveChanges();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Splash}/{id?}");

app.Run();
