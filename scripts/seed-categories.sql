-- ============================================
-- DIY Bench.io — Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- EXPENSE CATEGORIES (mapped to Schedule C)
-- ============================================

-- INCOME
INSERT INTO public.categories (id, name, schedule_c_line, type, business_types, description, keywords) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Sales Revenue', 'line_1', 'income', '{digital_marketing,hair_stylist}', 'Gross receipts from sales/services', '{stripe,paypal,square,invoice,payment,deposit,revenue}'),
  ('00000000-0000-0000-0001-000000000002', 'Refunds Given', 'line_2', 'income', '{digital_marketing,hair_stylist}', 'Returns and allowances', '{refund,return,credit,chargeback}'),
  ('00000000-0000-0000-0001-000000000003', 'Other Income', 'line_6', 'income', '{digital_marketing,hair_stylist}', 'Interest, affiliate income, etc.', '{interest,dividend,affiliate,cashback}'),
  ('00000000-0000-0000-0001-000000000004', 'Freelance Income', 'line_1', 'income', '{digital_marketing}', 'Freelance platform income (Upwork, etc.)', '{upwork,fiverr,freelance,escrow}'),

-- EXPENSES — Advertising (Line 8)
  ('00000000-0000-0000-0002-000000000001', 'Advertising & Marketing', 'line_8', 'expense', '{digital_marketing,hair_stylist}', 'Ads, promotions, marketing spend', '{google ads,facebook ads,meta ads,advertising,promotion,marketing,billboard,flyer,postcard}'),
  ('00000000-0000-0000-0002-000000000002', 'Social Media & Online Presence', 'line_8', 'expense', '{digital_marketing,hair_stylist}', 'Social media tools, domain, web presence', '{x corp,twitter,instagram,linkedin,social media,domain,webflow,squarespace,wix}'),

-- EXPENSES — Car/Truck (Line 9)
  ('00000000-0000-0000-0002-000000000003', 'Gas & Auto Expenses', 'line_9', 'expense', '{digital_marketing,hair_stylist}', 'Fuel, parking, tolls, car wash', '{gas,fuel,gasoline,shell,chevron,arco,parking,toll,car wash,auto}'),
  ('00000000-0000-0000-0002-000000000004', 'Auto Insurance', 'line_9', 'expense', '{digital_marketing,hair_stylist}', 'Vehicle insurance for business use', '{auto insurance,car insurance,geico,progressive,state farm}'),

-- EXPENSES — Commissions (Line 10)
  ('00000000-0000-0000-0002-000000000005', 'Merchant Processing Fees', 'line_10', 'expense', '{digital_marketing,hair_stylist}', 'Stripe, PayPal, Square fees', '{stripe fee,paypal fee,square fee,merchant fee,processing fee}'),

-- EXPENSES — Contract Labor (Line 11)
  ('00000000-0000-0000-0002-000000000006', 'Contract Labor', 'line_11', 'expense', '{digital_marketing,hair_stylist}', '1099 contractors, freelancers', '{contractor,freelancer,1099,subcontract}'),

-- EXPENSES — Depreciation / Section 179 (Line 13)
  ('00000000-0000-0000-0002-000000000007', 'Equipment & Depreciation', 'line_13', 'expense', '{digital_marketing,hair_stylist}', 'Computer, equipment purchases >$2500', '{computer,laptop,macbook,ipad,monitor,printer,equipment}'),

-- EXPENSES — Insurance (Line 15)
  ('00000000-0000-0000-0002-000000000008', 'Business Insurance', 'line_15', 'expense', '{digital_marketing,hair_stylist}', 'Liability, E&O, business insurance', '{business insurance,liability insurance,e&o,errors and omissions,united fin cas}'),
  ('00000000-0000-0000-0002-000000000009', 'Health Insurance', 'line_15', 'expense', '{digital_marketing,hair_stylist}', 'Health insurance premiums (self-employed)', '{health insurance,medical insurance,dental,vision,kaiser,blue cross,anthem}'),

-- EXPENSES — Interest (Line 16b)
  ('00000000-0000-0000-0002-000000000010', 'Interest & Bank Fees', 'line_16b', 'expense', '{digital_marketing,hair_stylist}', 'Credit card interest, bank fees, overdraft', '{interest charge,finance charge,bank fee,overdraft,monthly service fee,late fee}'),

-- EXPENSES — Legal/Professional (Line 17)
  ('00000000-0000-0000-0002-000000000011', 'Professional Services', 'line_17', 'expense', '{digital_marketing,hair_stylist}', 'Accountant, lawyer, bookkeeper, tax prep', '{accountant,attorney,lawyer,legal,bookkeeper,bench accounting,tax prep,cpa}'),
  ('00000000-0000-0000-0002-000000000012', 'Tax Software & Services', 'line_17', 'expense', '{digital_marketing}', 'CoinLedger, TurboTax, etc.', '{coinledger,turbotax,taxact,tax software}'),

-- EXPENSES — Office (Line 18)
  ('00000000-0000-0000-0002-000000000013', 'Office Supplies', 'line_18', 'expense', '{digital_marketing,hair_stylist}', 'Pens, paper, shipping, postage', '{office supplies,staples,office depot,ups store,fedex,usps,postage,shipping}'),

-- EXPENSES — Rent (Line 20b)
  ('00000000-0000-0000-0002-000000000014', 'Rent / Co-working', 'line_20b', 'expense', '{digital_marketing}', 'Office rent, co-working space', '{rent,coworking,co-working,regus,wework,office space}'),
  ('00000000-0000-0000-0002-000000000015', 'Booth/Chair Rental', 'line_20b', 'expense', '{hair_stylist}', 'Salon booth or chair rental fees', '{booth rental,chair rental,salon rent,station rent}'),

-- EXPENSES — Supplies (Line 22)
  ('00000000-0000-0000-0002-000000000016', 'Hair Supplies & Tools', 'line_22', 'expense', '{hair_stylist}', 'Scissors, color, shampoo, styling products', '{sally beauty,cosmoprof,hair color,shampoo,conditioner,scissors,clippers,styling}'),

-- EXPENSES — Taxes & Licenses (Line 23)
  ('00000000-0000-0000-0002-000000000017', 'Licenses & Permits', 'line_23', 'expense', '{digital_marketing,hair_stylist}', 'Business license, cosmetology license', '{license,permit,registration,renewal,state board}'),

-- EXPENSES — Travel (Line 24a)
  ('00000000-0000-0000-0002-000000000018', 'Travel', 'line_24a', 'expense', '{digital_marketing,hair_stylist}', 'Flights, hotels, Uber/Lyft for business', '{airline,flight,hotel,airbnb,uber,lyft,rental car,travel}'),

-- EXPENSES — Meals (Line 24b, 50% deductible)
  ('00000000-0000-0000-0002-000000000019', 'Business Meals', 'line_24b', 'expense', '{digital_marketing,hair_stylist}', 'Client meals, business meals (50% deductible)', '{restaurant,cafe,coffee,lunch,dinner,doordash,ubereats,grubhub}'),

-- EXPENSES — Utilities (Line 25)
  ('00000000-0000-0000-0002-000000000020', 'Utilities', 'line_25', 'expense', '{digital_marketing,hair_stylist}', 'Electric, water, gas (business portion)', '{edison,pg&e,so cal gas,water,electric,utility}'),
  ('00000000-0000-0000-0002-000000000021', 'Phone & Internet', 'line_25', 'expense', '{digital_marketing,hair_stylist}', 'Cell phone, internet (business portion)', '{verizon,vz wireless,at&t,t-mobile,spectrum,cox,internet,phone}'),

-- EXPENSES — Other (Line 27a)
  ('00000000-0000-0000-0002-000000000022', 'Software & Subscriptions', 'line_27a', 'expense', '{digital_marketing}', 'SaaS tools, software subscriptions', '{highlevel,gohighlevel,mailgun,openai,cursor,loom,codecademy,screaming frog,canva,adobe,figma,semrush,ahrefs}'),
  ('00000000-0000-0000-0002-000000000023', 'Education & Training', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Courses, certifications, conferences', '{course,training,certification,conference,workshop,udemy,coursera,masterclass}'),
  ('00000000-0000-0000-0002-000000000024', 'Dues & Subscriptions', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Professional memberships, trade publications', '{membership,subscription,association,dues}'),
  ('00000000-0000-0000-0002-000000000025', 'Waste & Disposal', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Trash, recycling, disposal services', '{marborg,waste,disposal,trash,recycling}'),
  ('00000000-0000-0000-0002-000000000026', 'Home Improvement (Business)', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Home office or studio improvements', '{home depot,lowes,hardware}'),

-- EXPENSES — Business Use of Home (Line 30)
  ('00000000-0000-0000-0002-000000000027', 'Home Office Expenses', 'line_30', 'expense', '{digital_marketing,hair_stylist}', 'Home office deduction (simplified or actual)', '{home office}'),

-- TRANSFER & PERSONAL
  ('00000000-0000-0000-0003-000000000001', 'Owner Draw / Distribution', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Money taken out by owner', '{owner draw,distribution,transfer to personal,transfer to everyday}'),
  ('00000000-0000-0000-0003-000000000002', 'Owner Contribution', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Money put in by owner', '{owner contribution,transfer from personal,transfer from savings}'),
  ('00000000-0000-0000-0003-000000000003', 'Internal Transfer', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Transfers between own accounts', '{transfer to,transfer from,online transfer}'),
  ('00000000-0000-0000-0003-000000000004', 'Loan Payment', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Loan payments (principal portion)', '{loan payment,ppp loan,stripe capital}'),
  ('00000000-0000-0000-0003-000000000005', 'Credit Card Payment', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Credit card bill payments', '{chase credit crd,barclaycard,credit card payment}'),

  ('00000000-0000-0000-0004-000000000001', 'Personal Expense', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Non-business personal expenses', '{personal}'),
  ('00000000-0000-0000-0004-000000000002', 'Personal - Groceries', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal grocery shopping', '{costco,sprouts,trader joe,whole foods,ralphs,vons,grocery}'),
  ('00000000-0000-0000-0004-000000000003', 'Personal - Entertainment', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal entertainment', '{netflix,hulu,disney,spotify,prime video,apple tv,audible,youtube,midjourney,oura}'),
  ('00000000-0000-0000-0004-000000000004', 'Personal - Shopping', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal shopping', '{amazon,target,walmart,clothing,billabong,blenders}'),
  ('00000000-0000-0000-0004-000000000005', 'Personal - Food & Drink', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal dining (not business meals)', '{taco bell,little caesars,wingstop,pressed juicery,coldstone,jersey mikes,7-eleven}'),
  ('00000000-0000-0000-0004-000000000006', 'Personal - Health', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal health expenses', '{cvs,pharmacy,doctor,dentist,medical}'),
  ('00000000-0000-0000-0004-000000000007', 'ATM Withdrawal', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Cash withdrawals', '{atm withdrawal,atm}'),
  ('00000000-0000-0000-0004-000000000008', 'Zelle / Venmo Transfer', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Peer-to-peer payments', '{zelle,venmo}'),
  ('00000000-0000-0000-0004-000000000009', 'Crypto / Investments', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Crypto transactions, trading', '{coinbase,tradingview,robinhood,webull,crypto}');
