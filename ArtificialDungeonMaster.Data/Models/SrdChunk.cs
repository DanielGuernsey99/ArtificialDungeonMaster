using System;
using System.ComponentModel.DataAnnotations;

namespace ArtificialDungeonMaster.Data.Models
{
    /// <summary>
    /// Chunk of the D&D 5.1 SRD (or other legal rules text) for RAG.
    /// </summary>
    public sealed class SrdChunk
    {
        public Guid Id { get; set; }

        [MaxLength(128)]
        public string? Section { get; set; } // e.g., "Combat", "Conditions: Grappled"

        public string Text { get; set; } = string.Empty;

        // Vector embedding (VECTOR(1536) in SQL Server/Azure SQL)
        public float[]? Embedding { get; set; }

        [MaxLength(32)]
        public string Source { get; set; } = "srd5.1";

        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    }
}
