const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Vercel requires raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    const fields = {
      'Order Ref':       meta.orderRef || session.id,
      'Customer Name':   meta.customerName || '',
      'Email':           session.customer_email || '',
      'Amount Paid':     (session.amount_total / 100).toFixed(2),
      'Currency':        (session.currency || 'usd').toUpperCase(),
      'Mat Name 1':      meta.matName1 || '',
      'Mat Name 2':      meta.matName2 || '',
      'Mat Name 3':      meta.matName3 || '',
      'Mat Name 4':      meta.matName4 || '',
      'Symbol':          meta.symbol || '',
      'Color':           meta.color || '',
      'Shipping Address': meta.address || '',
      'Payment Status':  session.payment_status || '',
      'Stripe Session':  session.id,
      'Created At':      new Date().toISOString()
    };

    try {
      const airtableRes = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields })
        }
      );

      if (!airtableRes.ok) {
        const errText = await airtableRes.text();
        console.error('Airtable error:', errText);
        return res.status(500).send('Airtable write failed');
      }

      console.log('Order logged to Airtable:', fields['Order Ref']);
    } catch (err) {
      console.error('Airtable fetch error:', err.message);
      return res.status(500).send('Airtable request failed');
    }
  }

  return res.status(200).json({ received: true });
};
