import { db, settings, registrationState } from "@/lib/db";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "রেজিস্ট্রেশন | মিলনমেলা — চুপাইর জামিউল উলুম আলিম মাদরাসা",
  description:
    "৫০ বছর পূর্তি ও প্রাক্তন ছাত্র পুনর্মিলনী ২০২৭ — অনলাইনে রেজিস্ট্রেশন করুন।",
  openGraph: {
    title: "অনলাইন রেজিস্ট্রেশন | পুনর্মিলনী ২০২৭ — চুপাইর মাদরাসা",
    description:
      "৫০ বছরের গৌরব, প্রজন্মের বন্ধন। পুনর্মিলনীতে অংশ নিতে আপনার তথ্য দিয়ে অনলাইনে রেজিস্ট্রেশন সম্পন্ন করুন।",
    images: [
      {
        url: "/pic/og-banner.jpg",
        width: 1200,
        height: 630,
        alt: "চুপাইর জামিউল উলুম আলিম মাদরাসা",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "অনলাইন রেজিস্ট্রেশন | পুনর্মিলনী ২০২৭ — চুপাইর মাদরাসা",
    description:
      "৫০ বছরের গৌরব, প্রজন্মের বন্ধন। পুনর্মিলনীতে অংশ নিতে আপনার তথ্য দিয়ে অনলাইনে রেজিস্ট্রেশন সম্পন্ন করুন।",
    images: ["/pic/og-banner.jpg"],
  },
};

export default async function RegisterPage() {
  let initialSettings = null;
  try {
    await db();
    const s = await settings();
    const state = registrationState(s);
    initialSettings = JSON.parse(JSON.stringify({ ...s, ...state }));
  } catch {
    initialSettings = {
      registrationOpen: true,
      eventDateTime: "2027-08-15T10:00:00+06:00",
      eventTitle: "৫০ বছর পূর্তি ও প্রাক্তন ছাত্র পুনর্মিলনী",
      eventHijriDate: "১২ রবিউল আউয়াল",
      registrationFee: 200,
      paymentNumber: "+8801812945767",
      open: true,
    };
  }

  return <RegisterForm initialSettings={initialSettings} />;
}
