import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "station";
  const value = searchParams.get("value");
  
  if (!value) {
    return NextResponse.json({ error: "Missing parameter value" }, { status: 400 });
  }
  
  try {
    const url = `https://playerservices.streamtheworld.com/api/livestream?version=1.10&${type}=${encodeURIComponent(value)}`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 } // Disable caching to fetch live requests
    });
    
    if (!res.ok) {
      return NextResponse.json(
        { error: `Triton server responded with status: ${res.status}` },
        { status: res.status }
      );
    }
    
    const xmlText = await res.text();
    
    return new NextResponse(xmlText, {
      headers: {
        "Content-Type": "application/xml",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
