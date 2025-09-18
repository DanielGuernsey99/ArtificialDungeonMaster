using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArtificialDungeonMaster.Data.Models
{
    /// <summary>
    /// Lightweight, structured summary of the current story state.
    /// Stored as JSON (owned type) so sessions can resume instantly.
    /// </summary>
    public sealed class StoryState
    {
        public string SceneSummary { get; set; } = "";          // one-paragraph recap
        public List<string> Objectives { get; set; } = new();   // short actionable goals
        public List<string> OpenThreads { get; set; } = new();  // mysteries / leads / promises
        [NotMapped] public Dictionary<string, string> WorldFlags { get; set; } = new(); // arbitrary flags
        [NotMapped] public Dictionary<string, int> PartyHP { get; set; } = new();        // simple HP map if desired
        public string? Location { get; set; }                                   // current place/region
        public string? TimeOfDay { get; set; }                                   // “dawn”, “night”, etc.
    }
}
