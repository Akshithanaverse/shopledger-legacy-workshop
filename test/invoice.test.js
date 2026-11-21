var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('invoice matches billed totals and GST for an HSN-rated discounted order', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }),
    billed.lines.map(function (line) { return [line.gstPercent, line.tax]; }));
});

test('invoice uses the same HSN slab and total as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice handles an explicit decimal gstRate like order pricing', function () {
  var item = { name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 };
  var invoiceFigures = invoice.computeInvoiceFigures({ items: [item] });
  var priced = pricing.computeTotals([item], '');

  assert.equal(priced.tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice applies coupon discount before calculating GST, like order pricing', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 47.5);
  assert.equal(billed.total, 997.5);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice CGST and SGST match order pricing rounding', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Odd amount', price: 0.05, qty: 1, gstRate: 10 }]
  });

  assert.equal(figures.tax, 0.01);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0);
  assert.deepEqual({ cgst: figures.cgst, sgst: figures.sgst }, tax.splitCgstSgst(figures.tax));
});

test('rendered invoice total matches the stored order total without a reconciliation warning', function () {
  var html = invoice.render({
    id: 42,
    total: 105,
    coupon: '',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.ok(html.includes('Invoice Total'));
  assert.ok(html.includes('105.00</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
