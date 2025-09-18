using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ArtificialDungeonMaster.Data.Models
{
    public class AzureEmailOptions
    {
        public string ConnectionString { get; set; } = "";
        public string From { get; set; } = "";
        public string DisplayName { get; set; } = "";
    }
}
