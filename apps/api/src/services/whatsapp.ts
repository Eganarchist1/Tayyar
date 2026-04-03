import axios from "axios";
import { env } from "../config";

type WhatsAppMessageResult = {
  messageId?: string;
  skipped?: boolean;
};

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  return trimmed.replace(/^0/, "+20");
}

export class WhatsAppService {
  private static get apiUrl() {
    return env.WHATSAPP_PHONE_NUMBER_ID
      ? `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`
      : null;
  }

  private static async postMessage(payload: Record<string, unknown>): Promise<WhatsAppMessageResult> {
    if (!this.apiUrl || !env.WHATSAPP_API_TOKEN) {
      return { skipped: true };
    }

    const response = await axios.post(
      this.apiUrl,
      payload,
      {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      messageId: response.data?.messages?.[0]?.id,
    };
  }

  static async sendMessage(to: string, message: string) {
    return this.postMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { body: message },
    });
  }

  static async sendLoginLink(to: string, token: string) {
    const loginLink = `tayyar://login?token=${token}`;
    const message = `Welcome pilot.\n\nUse the link below to sign in to Tayyar:\n${loginLink}\n\nDo not share this link.`;
    return this.sendMessage(to, message);
  }

  static async sendLocationRequest(to: string, merchantName: string, branchName: string) {
    return this.postMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: {
          text: `شارك موقعك علشان ${merchantName} يقدر يجهز طلبك من ${branchName}.`,
        },
        action: {
          name: "send_location",
        },
      },
    });
  }
}

export { normalizePhone };
