using ArtificialDungeonMaster.Data.Models;
using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ArtificialDungeonMaster.Data.Services
{
    public interface IEmailSenderService
    {
        Task SendAsync(string to, string subject, string htmlBody);
    }

    public class EmailSenderService : IEmailSenderService
    {
        private readonly EmailClient _client;
        private readonly AzureEmailOptions _o;

        public EmailSenderService(IOptions<AzureEmailOptions> opts)
        {
            _o = opts.Value;
            _client = new EmailClient(_o.ConnectionString);
        }

        public async Task SendAsync(string to, string subject, string htmlBody)
        {
            var msg = new EmailMessage(
                senderAddress: _o.From,
                content: new EmailContent(subject) { Html = htmlBody },
                recipients: new EmailRecipients(new[] { new EmailAddress(to) })
            );

            // Wait for completion so failures bubble up during dev
            await _client.SendAsync(WaitUntil.Completed, msg);
        }
    }
}
