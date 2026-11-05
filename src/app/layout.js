import "./globals.css";
import ScrollToTop from "@/components/scroll-to-top";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3100");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "মিলনমেলা | চুপাইর জামিউল উলুম আলিম মাদরাসা",
    template: "%s | মিলনমেলা",
  },
  description:
    "৫০ বছরের গৌরব, প্রজন্মের বন্ধন। চুপাইর জামিউল উলুম আলিম মাদরাসার সুবর্ণজয়ন্তী ও প্রাক্তন ছাত্র পুনর্মিলনী ২০২৭ — অনলাইনে রেজিস্ট্রেশন করুন।",
  keywords: [
    "মিলনমেলা",
    "চুপাইর মাদরাসা",
    "চুপাইর জামিউল উলুম আলিম মাদরাসা",
    "পুনর্মিলনী ২০২৭",
    "সুবর্ণজয়ন্তী",
    "Alumni Reunion",
    "Chupair Madrasah",
  ],
  authors: [{ name: "চুপাইর জামিউল উলুম আলিম মাদরাসা" }],
  creator: "চুপাইর জামিউল উলুম আলিম মাদরাসা",
  publisher: "চুপাইর জামিউল উলুম আলিম মাদরাসা",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: "/",
    siteName: "মিলনমেলা — চুপাইর জামিউল উলুম আলিম মাদরাসা",
    title: "৫০ বছরের গৌরব, প্রজন্মের বন্ধন | সুবর্ণজয়ন্তী ও পুনর্মিলনী ২০২৭",
    description:
      "চুপাইর জামিউল উলুম আলিম মাদরাসার সুবর্ণজয়ন্তী ও প্রাক্তন ছাত্র পুনর্মিলনী ২০২৭। শেকড়ের টানে আবার একসাথে, অনলাইনে এখনই আপনার রেজিস্ট্রেশন সম্পন্ন করুন।",
    images: [
      {
        url: "/pic/og-banner.jpg",
        width: 1200,
        height: 630,
        alt: "চুপাইর জামিউল উলুম আলিম মাদরাসা — সুবর্ণজয়ন্তী ও পুনর্মিলনী ২০২৭",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "৫০ বছরের গৌরব, প্রজন্মের বন্ধন | সুবর্ণজয়ন্তী ও পুনর্মিলনী ২০২৭",
    description:
      "চুপাইর জামিউল উলুম আলিম মাদরাসার সুবর্ণজয়ন্তী ও প্রাক্তন ছাত্র পুনর্মিলনী ২০২৭। অনলাইনে এখনই আপনার রেজিস্ট্রেশন সম্পন্ন করুন।",
    images: ["/pic/og-banner.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function Layout({ children }) {
  return (
    <html lang="bn">
      <body>
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
