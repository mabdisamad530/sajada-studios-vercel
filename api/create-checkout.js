const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      priceId,
      email,
      orderRef,
      customerName,
      matName1,
      matName2,
      matName3,
      matName4,
      symbol,
      color,
      address,
      quantity,
      successUrl,
      cancelUrl
    } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{ price: priceId, quantity: quantity || 1 }],
      allow_promotion_codes: true,
      metadata: {
        customerName: customerName || '',
        orderRef: orderRef || '',
        matName1: matName1 || '',
        matName2: matName2 || '',
        matName3: matName3 || '',
        matName4: matName4 || '',
        symbol: symbol || '',
        color: color || '',
        address: address || ''
      },
      success_url: successUrl || `${req.headers.origin}/success.html`,
      cancel_url: cancelUrl || `${req.headers.origin}/`
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
