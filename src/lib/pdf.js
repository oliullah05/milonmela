import React from "react";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import QRCode from "qrcode";
import path from "node:path";

const h = React.createElement;
const Box = View;
const FONT = path.join(process.cwd(), "public/fonts/bangla.ttf");
const SCALE = 4; // 288 dpi at the final PDF size, including when printed.
const GREEN = "#115b43";
const INK = "#152f29";
const escapeMarkup = value => String(value ?? "").normalize("NFC")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Keep whole Bengali runs together. Pango/HarfBuzz shapes conjuncts and vowel
// marks before rasterization; React PDF never reorders or splits those glyphs.
async function bengali(value, {size=12, width=490, maxHeight=45, color=INK, bold=false, align="center"}={}) {
  const text = escapeMarkup(value);
  for (let pointSize=size; pointSize>=9; pointSize-=0.5) {
    const {data, info} = await sharp({text:{
      text:`<span foreground="${color}" weight="${bold ? 700 : 400}" lang="bn">${text}</span>`,
      font:`Noto Sans Bengali ${pointSize}`, fontfile:FONT, dpi:72*SCALE,
      width:Math.round(width*SCALE), rgba:true, align:align==="center"?"centre":align,
      wrap:"word-char", spacing:Math.round(pointSize*0.18*SCALE),
    }}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer({resolveWithObject:true});
    if (info.height/SCALE<=maxHeight || pointSize===9) {
      return h(Image,{src:data,style:{width:info.width/SCALE,height:info.height/SCALE,flexShrink:0,objectFit:"contain",alignSelf:align==="center"?"center":"flex-start"}});
    }
  }
  throw new Error("Unable to fit slip text");
}

async function portrait(photoUrl) {
  const fallback=()=>sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#edf4ef"/><circle cx="320" cy="247" r="110" fill="#b3cbbd"/><path d="M100 640v-78c0-121 98-203 220-203s220 82 220 203v78" fill="#b3cbbd"/></svg>')).png().toBuffer();
  if(!photoUrl)return fallback();
  try {
    const prefix=`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
    if(!photoUrl.startsWith(prefix))return fallback();
    const response=await fetch(photoUrl,{signal:AbortSignal.timeout(8000),redirect:"error"});
    if(!response.ok || Number(response.headers.get("content-length"))>5*1024*1024)return fallback();
    const reader=response.body.getReader();const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024){await reader.cancel();return fallback();}chunks.push(Buffer.from(value));}
    return await sharp(Buffer.concat(chunks),{limitInputPixels:25_000_000}).rotate().resize(640,640,{fit:"cover"}).png().toBuffer();
  } catch { return fallback(); }
}
const bnDate = value => new Date(value).toLocaleDateString("bn-BD",{timeZone:"Asia/Dhaka",day:"numeric",month:"long",year:"numeric"});
const bnTime = value => new Date(value).toLocaleTimeString("bn-BD",{timeZone:"Asia/Dhaka",hour:"numeric",minute:"2-digit",hour12:true}).replace("AM","পূর্বাহ্ণ").replace("PM","অপরাহ্ণ");

export async function makeSlip(student,event,origin) {
  const verificationUrl=`${origin}/verify/${student.verificationToken}`;
  const knownBlood=["A+","A-","B+","B-","AB+","AB-","O+","O-"].includes(student.bloodGroup);
  const [school,title,eventDate,hijri,slipTitle,name,labels,values,fee,approval,instruction,qr,photo,jubilee]=await Promise.all([
    bengali("চুপাইর জামিউল উলুম আলিম মাদরাসা",{size:19,bold:true,maxHeight:30}),
    bengali(event.eventTitle,{size:16,bold:true,color:GREEN,maxHeight:32}),
    bengali(`${bnDate(event.eventDateTime)}  ·  ${bnTime(event.eventDateTime)}`,{size:11.5,maxHeight:28}),
    bengali(event.eventHijriDate||"",{size:10.5,color:"#63776a",maxHeight:22}),
    bengali("পুনর্মিলনী কনফার্মেশন স্লিপ",{size:13,bold:true,color:"#ffffff",width:320,maxHeight:25}),
    bengali(student.name,{size:27,bold:true,width:480,maxHeight:44}),
    Promise.all(["মোবাইল নম্বর","দাখিল ব্যাচ",knownBlood?"রক্তের গ্রুপ":"অংশগ্রহণ","রেজিস্ট্রেশনের অবস্থা"].map(t=>bengali(t,{size:10.5,color:"#66796d",width:210,align:"left",maxHeight:20}))),
    Promise.all([student.mobile,String(student.batchYear),knownBlood?student.bloodGroup:"প্রাক্তন ছাত্র","অনুমোদিত ও নিশ্চিত"].map(t=>bengali(t,{size:14,bold:true,width:210,align:"left",maxHeight:30}))),
    bengali(`রেজিস্ট্রেশন ফি: ৳ ${(student.amount || 200).toLocaleString("bn-BD")} — পরিশোধিত ও যাচাইকৃত`,{size:11.5,bold:true,color:GREEN,maxHeight:25}),
    bengali(`অনুমোদন: ${bnDate(student.approvedAt)} · ${bnTime(student.approvedAt)}`,{size:10,color:"#63776a",maxHeight:24}),
    bengali("ইভেন্টের দিন এই স্লিপ সঙ্গে আনুন",{size:12,bold:true,color:GREEN,maxHeight:24}),
    QRCode.toBuffer(verificationUrl,{width:540,margin:3,errorCorrectionLevel:"M",color:{dark:GREEN,light:"#ffffff"}}),
    portrait(student.photoUrl),
    bengali("৫০",{size:27,bold:true,color:"#b38b3d",width:70,maxHeight:43}),
  ]);
  const english=(text,style={})=>h(Text,{style:{fontFamily:"Helvetica",fontSize:10,color:INK,...style}},text);
  const infoCell=(index)=>h(Box,{style:{width:"50%",paddingVertical:8,paddingHorizontal:17,gap:6}},labels[index],values[index]);
  return renderToBuffer(h(Document,{title:`${student.registrationNumber} - Reunion Confirmation`,author:"Chupair Jamiul Ulum Alim Madrasah",subject:"Verified alumni reunion registration",language:"bn-BD"},
    h(Page,{size:[595.28,841.89],wrap:false,style:{height:841.89,minHeight:841.89,padding:34,backgroundColor:"#ffffff",fontFamily:"Helvetica",color:INK}},
      h(Box,{style:{position:"absolute",top:0,left:0,right:0,height:7,backgroundColor:GREEN}}),
      h(Box,{style:{position:"absolute",top:14,left:14,right:14,bottom:14,borderWidth:1,borderColor:"#deebe3",borderRadius:15}}),
      h(Box,{style:{position:"absolute",top:-66,left:-63,width:145,height:145,borderRadius:73,backgroundColor:"#e5f3eb"}}),
      h(Box,{style:{position:"absolute",bottom:-67,right:-65,width:150,height:150,borderRadius:75,backgroundColor:"#e5f3eb"}}),
      h(Box,{style:{alignItems:"center",paddingTop:4,gap:6}},school,
        english("CHUPAIR JAMIUL ULUM ALIM MADRASAH",{fontSize:9,letterSpacing:1.2,color:"#65786c",textAlign:"center"}),
        h(Box,{style:{marginTop:7}},title),eventDate,hijri,
        h(Box,{style:{backgroundColor:GREEN,borderRadius:22,paddingVertical:9,paddingHorizontal:20,marginTop:5,marginBottom:14}},slipTitle)),
      h(Box,{style:{height:148,alignItems:"center",justifyContent:"center",marginBottom:13}},
        h(Box,{style:{width:148,height:148,borderRadius:74,borderWidth:1.3,borderColor:"#bad5c5",padding:7}},
          h(Box,{style:{width:131,height:131,borderRadius:66,borderWidth:2.5,borderColor:GREEN,padding:4}},
            h(Image,{src:photo,style:{width:118,height:118,borderRadius:59,objectFit:"cover"}}))),
        h(Box,{style:{position:"absolute",left:22,top:38,width:82,alignItems:"center",gap:4}},jubilee,english("GOLDEN JUBILEE",{fontSize:7,letterSpacing:.7,color:"#967535"})),
        h(Box,{style:{position:"absolute",right:0,top:65,borderWidth:1.5,borderColor:GREEN,borderRadius:6,paddingVertical:9,paddingHorizontal:12,transform:"rotate(-8deg)"}},english("CONFIRMED",{fontSize:13,fontFamily:"Helvetica-Bold",letterSpacing:1,color:GREEN}))),
      h(Box,{style:{alignItems:"center",gap:8,marginBottom:16}},name,
        english("REGISTRATION NUMBER",{fontSize:8,letterSpacing:1.7,color:"#708375"}),
        english(student.registrationNumber,{fontSize:18,fontFamily:"Helvetica-Bold",letterSpacing:1,color:GREEN})),
      h(Box,{style:{borderWidth:1,borderColor:"#dde8df",borderRadius:10,backgroundColor:"#f7faf7",paddingVertical:3}},
        h(Box,{style:{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#e0e9e2"}},infoCell(0),infoCell(1)),
        h(Box,{style:{flexDirection:"row"}},infoCell(2),infoCell(3))),
      h(Box,{style:{marginTop:14,alignItems:"center",gap:6}},fee,
        h(Image,{src:qr,style:{width:94,height:94}}),
        english("SCAN TO VERIFY / EVENT CHECK-IN",{fontSize:7.5,letterSpacing:1,color:"#65786c"})),
      h(Box,{style:{marginTop:13,alignItems:"center",gap:9}},approval,
        h(Box,{style:{paddingVertical:10,paddingHorizontal:15,borderRadius:7,backgroundColor:"#edf5ee",width:"100%"}},instruction)),
      english("50 YEARS OF HERITAGE  /  A LIFETIME OF CONNECTION",{position:"absolute",bottom:25,left:34,right:34,fontSize:7,letterSpacing:1.1,textAlign:"center",color:"#809184"})
    )));
}

