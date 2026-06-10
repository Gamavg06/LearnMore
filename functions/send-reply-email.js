import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, subject, message, reply } = await req.json();

    const targetEmail = String(email || '').trim();
    if (!targetEmail) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'LearnMore <noreply@learnmore.app>',
        to: [targetEmail],
        reply_to: 'support@learnmore.app',
        subject: `Re: ${subject || 'Tu mensaje de contacto'}`,
        html: `
          <h1>Hemos respondido a tu mensaje</h1>
          <p>Gracias por contactarnos. Hemos respondido a tu mensaje:</p>
          <blockquote style="background:#f4f7fb;padding:12px;border-radius:8px;">${message || ''}</blockquote>
          <p><strong>Respuesta:</strong></p>
          <p>${reply || ''}</p>
        `,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify(data), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ sent: true, id: data.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
