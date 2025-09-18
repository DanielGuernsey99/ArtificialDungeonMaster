using System;
using System.ComponentModel.DataAnnotations;

namespace ArtificialDungeonMaster.Data.Models
{
    public enum CharacterSource { Manual = 0, DnDBeyondJson = 1 }

    public sealed class Character
    {
        public Guid Id { get; set; }

        // Owner
        public Guid UserId { get; set; }

        [Required, MaxLength(64)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(64)]
        public string? Class { get; set; }

        [MaxLength(64)]
        public string? Race { get; set; }

        public int Level { get; set; } = 1;

        // Store original D&D Beyond JSON (user-provided—no scraping)
        public string? RawJson { get; set; }

        // Common normalized fields for prompting
        public int Str { get; set; } = 10;
        public int Dex { get; set; } = 10;
        public int Con { get; set; } = 10;
        public int Int { get; set; } = 10;
        public int Wis { get; set; } = 10;
        public int Cha { get; set; } = 10;

        public CharacterSource Source { get; set; } = CharacterSource.Manual;
    }
}
