using Microsoft.AspNetCore.Identity;
using System;

namespace ArtificialDungeonMaster.Data.Models
{
    public sealed class AppUser : IdentityUser<Guid>
    {
        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<Character> Characters { get; set; } = new List<Character>();
        public ICollection<AdventureSession> Sessions { get; set; } = new List<AdventureSession>();
    }
}