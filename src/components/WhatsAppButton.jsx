import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl, fillWhatsAppTemplate, getPublicSettings } from "@/lib/plans.functions";
const WHATSAPP_DISPLAY = "0337 7771527";
function useWhatsApp() {
  const { data } = useQuery({ queryKey: ["public-settings"], queryFn: () => getPublicSettings(), staleTime: 6e4 });
  const number = data?.whatsapp_number ?? "923377771527";
  const template = data?.whatsapp_message ?? "Hi Origami99, I'd like to subscribe.";
  return {
    number,
    display: number.replace(/^92/, "0"),
    urlFor: (vars = {}) => buildWhatsAppUrl(number, fillWhatsAppTemplate(template, vars))
  };
}
function WhatsAppButton() {
  const wa = useWhatsApp();
  return <a
    href={wa.urlFor()}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat on WhatsApp"
    className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-success text-primary-foreground shadow-glow transition-transform hover:scale-110"
  >
      <MessageCircle className="h-6 w-6" />
    </a>;
}
export {
  WHATSAPP_DISPLAY,
  WhatsAppButton,
  useWhatsApp
};
