import os
import json

DIR_PATH = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(DIR_PATH, "multilingual_voice_dataset.json")

def load_multilingual_dataset():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

TRAINING_DATA = [
    # ─── BANKING / KYC FRAUD ─────────────────────────────────────────
    ("Your SBI account has been blocked due to incomplete KYC. To reactivate, share your Aadhaar number and OTP sent to your mobile immediately.", 1),
    ("This is a call from HDFC bank. Your account will be suspended in 2 hours if you do not update your KYC. Please share the OTP now.", 1),
    ("Hello, I am calling from the RBI compliance department. Your account is flagged for unusual activity. Please share your account number and CVV to verify.", 1),
    ("Your PAN card is linked to illegal transactions. To avoid arrest, transfer rupees 50000 to the compliance account immediately.", 1),
    ("I am calling from your bank's fraud department. Share the OTP you just received to stop an unauthorised transaction on your account.", 1),
    ("Dear customer, your net banking has been suspended. Call us immediately and share your password to restore access.", 1),
    ("Your ATM card is going to be deactivated due to KYC mismatch. Share your 16 digit card number and CVV to stop this.", 1),
    ("This is an urgent alert from ICICI bank. A transaction of rupees 89000 is pending on your account. Share the OTP to cancel it.", 1),
    ("We are calling from the income tax department. Your tax refund of rupees 45000 is ready but your bank details need verification. Share your account number.", 1),
    ("This is Axis bank calling. Your debit card will expire today. To renew it please share your card number and the OTP we just sent.", 1),
    # ─── DIGITAL ARREST / POLICE IMPERSONATION ───────────────────────
    ("I am a CBI officer. Your Aadhaar card is linked to 3 illegal bank accounts involved in money laundering. You will be arrested in 2 hours unless you pay the clearance fine.", 1),
    ("This is the cybercrime division of the Mumbai police. You are under digital arrest for sending obscene messages. Cooperate or we will send officers to your home.", 1),
    ("This is an officer from Narcotics Control Bureau. A package with drugs was seized in your name at Mumbai airport customs. Pay the penalty to avoid FIR.", 1),
    ("I am from the CBI and we have a court order to freeze your bank account. Transfer rupees 2 lakh to the safe custody account within one hour.", 1),
    ("Your mobile number is linked to a criminal network. I am officer Sharma from cybercrime. Stay on the line or you will be arrested immediately.", 1),
    ("This is the ED enforcement directorate. A money laundering case is registered in your name. Pay the bail amount of rupees 1 lakh through UPI immediately.", 1),
    ("We are from the telecom regulatory authority. Your SIM card will be blocked in one hour for suspicious activity. Share your Aadhaar to avoid blocking.", 1),
    ("This is a court notice. You have failed to appear before the judge. Pay the contempt fine of rupees 25000 within the next 30 minutes to avoid arrest.", 1),
    ("I am Inspector Verma from the cyber police. We have recorded your video call. Pay rupees 50000 to avoid this from going public.", 1),
    ("You have violated TRAI regulations. Your number will be disconnected permanently in 2 hours. Call our helpline and share your Aadhaar to restore service.", 1),
    # ─── LOTTERY / PRIZE / REFUND SCAM ──────────────────────────────
    ("Congratulations! Your mobile number has won rupees 25 lakh in the KBC lucky draw. To claim your prize, pay the processing fee of rupees 5000 and share your account details.", 1),
    ("You have been selected for a government refund of rupees 8500 due to excess tax deduction. Share your account number and IFSC to receive the refund.", 1),
    ("Your number has been selected in the Jio lucky draw. You have won an iPhone 15. To claim, pay the courier charges of rupees 2000 and give us your address.", 1),
    ("Congratulations from Amazon! You are our lucky winner of the month. To collect your prize of rupees 50000, pay a small registration fee of rupees 1500.", 1),
    ("The government has approved a special farmer subsidy for your account. Share your bank details and Aadhaar to receive rupees 6000 directly.", 1),
    ("Your EPF pension withdrawal of rupees 3 lakh has been approved. To process, pay the service tax of rupees 4500 and share your PAN number.", 1),
    ("You are eligible for a zero-interest loan of rupees 5 lakh under the PM scheme. Activate it now by paying the processing fee of rupees 2000.", 1),
    ("We are calling from BSNL. You are eligible for a free data recharge of 365 days. Share the OTP sent to your number to activate it.", 1),
    ("Your mutual fund has generated a special dividend of rupees 45000. To receive it today, share your account number and sign a digital confirmation by phone.", 1),
    ("This is the RBI helpline. You are entitled to an unclaimed dividend of rupees 1.2 lakh. Share your bank details to process the transfer today.", 1),
    # ─── TECH SUPPORT SCAM ──────────────────────────────────────────
    ("I am calling from Microsoft support. Your computer has been infected with a serious virus and we have detected illegal access. Download AnyDesk so we can fix it remotely.", 1),
    ("This is Windows technical support. Your license has expired and your computer is at risk. Please give us remote access by installing TeamViewer immediately.", 1),
    ("We are from your internet service provider. We detected suspicious traffic from your router. Install QuickSupport on your phone so we can check it.", 1),
    ("I am calling from Apple support. Your iCloud account has been compromised. Share your Apple ID password so we can secure it.", 1),
    ("Your antivirus subscription has expired and we have detected 47 viruses on your system. To remove them, allow us remote access using AnyDesk right now.", 1),
    ("This is Google support. Someone in another country is using your Gmail account. Share the 6 digit code sent to your phone to block them.", 1),
    ("We are from McAfee and your PC security subscription has expired. Pay rupees 2500 now and give us access to renew it without losing your data.", 1),
    ("This is a call from the Jio network team. Your broadband speed is being throttled due to a technical error. Share screen access so our engineer can fix it.", 1),
    ("Your payment app is showing a suspicious login from another device. Share the OTP sent to your phone immediately so we can block the access.", 1),
    ("We are from your bank's technical team. There is a software issue with your UPI that may cause you to lose money. Install this app and give us access.", 1),
    # ─── OTP / CREDENTIAL PHISHING ──────────────────────────────────
    ("Please share the OTP sent to your registered mobile number to complete the KYC verification process on your account.", 1),
    ("Tell me the OTP you just received. This is required to stop the fraudulent transaction from your account.", 1),
    ("Share the 6 digit code from your message. Without it we cannot process your refund and the amount will be forfeited.", 1),
    ("What is the OTP that came on your phone? I need it to verify your identity as part of our security check.", 1),
    ("Give me the PIN of your ATM card so our engineer can reset it and prevent unauthorised transactions.", 1),
    ("Share your netbanking username and password. This is needed to deactivate the suspicious access on your account.", 1),
    ("Tell me your 4-digit UPI PIN. The bank needs to verify it to reactivate your account that was suspended.", 1),
    ("What is the CVV number on the back of your card? We need it to issue your replacement card immediately.", 1),
    ("Read out the OTP from the SMS we just sent. This is the final step to block the fraudulent access we detected.", 1),
    ("Confirm your date of birth and your account password to complete the identity verification and unlock your blocked account.", 1),
    # ─── COURIER / PARCEL SCAM ──────────────────────────────────────
    ("A package in your name has been seized at Mumbai customs containing fake currency. Pay the penalty of rupees 35000 to avoid police action.", 1),
    ("Your FedEx parcel is stuck at Delhi airport customs. It contains illegal items. Pay the clearance fee of rupees 15000 to release it.", 1),
    ("We are from the postal department. A parcel with drugs addressed to you was intercepted. Pay the fine or face arrest under the NDPS Act.", 1),
    ("Your Amazon package has been seized because it contains prohibited items. Share your Aadhaar and pay rupees 20000 to claim it.", 1),
    ("A courier from abroad with your name was stopped. It has contraband inside. Pay a fine of rupees 50000 or be arrested today.", 1),
    # ─── INVESTMENT / TRADING SCAM ──────────────────────────────────
    ("I am a certified financial advisor. Our AI trading platform guarantees 40 percent monthly returns. Invest rupees 50000 today and double your money in 2 months.", 1),
    ("Join our private WhatsApp group for guaranteed stock market tips. Members have made over 5 lakh in the last month. Pay a small entry fee of rupees 3000.", 1),
    ("Your SEBI registration as an investor has lapsed. Pay the renewal fee of rupees 8000 to continue trading or your account will be frozen.", 1),
    ("We are from the crypto investment club. Pay rupees 20000 in Bitcoin and get 3 times return in 30 days. This offer is only for today.", 1),
    ("Our mutual fund is giving 60 percent annual returns. The scheme closes tomorrow. Invest rupees 1 lakh and withdraw anytime without penalty.", 1),
    # ─── ADDITIONAL SCAM VARIANTS ────────────────────────────────────
    ("Your electricity connection will be disconnected tonight due to non-payment. Pay rupees 2500 through this UPI link immediately to avoid disconnection.", 1),
    ("This is TRAI. Your mobile number will be permanently blocked in 2 hours. Call back on this number and share your Aadhaar to stop the block.", 1),
    ("You have an unpaid electricity bill and the power will be cut in 30 minutes. Scan this QR code and pay rupees 1800 to avoid disconnection.", 1),
    ("I am from the insurance company. Your father's life insurance claim of rupees 12 lakh has been approved. Pay the service tax of rupees 15000 to release the amount.", 1),
    ("This is the gas agency. Your LPG subsidy of rupees 3600 will expire tonight. Share your bank account number to receive it before midnight.", 1),
    ("Your Aadhaar is linked to a suspicious phone number used by terrorists. I am from the CBI. Cooperate with this inquiry or face immediate arrest.", 1),
    ("You were caught in CCTV taking drugs. To avoid FIR, pay rupees 40000 through PhonePe immediately. This is the last warning.", 1),
    ("Your daughter's college admission fee has been processed. Please pay the remaining rupees 8000 to complete the enrollment. Share the OTP sent to her number.", 1),
    ("We are from the health insurance company. Your claim has been denied due to documentation error. Share your Aadhaar and bank details to resubmit.", 1),
    ("Congratulations from the BPCL lottery. Your mobile number won a Toyota Fortuner. Pay the road tax of rupees 35000 and collect your car.", 1),
    # ─── LEGITIMATE CALLS ────────────────────────────────────────────
    ("Hello, I am calling from the HDFC home loans team. We noticed you recently searched for home loan options. I just wanted to share our current interest rates of 8.5 percent. No commitment needed.", 0),
    ("Hi, this is a reminder call from your dentist clinic. Your appointment is scheduled for tomorrow at 11 AM. Please call us if you need to reschedule.", 0),
    ("Good morning, this is a call from your insurance provider. Your policy renewal is due next month. I can send you the renewal link on WhatsApp if you like.", 0),
    ("Hello, I am calling from Swiggy customer support. Your recent order had a delay and we want to offer you a coupon worth 100 rupees as a goodwill gesture.", 0),
    ("This is a reminder from the municipal corporation. Property tax payment for the financial year is now open. You can pay online at our portal.", 0),
    ("Hi, I am calling from Amazon. I noticed you returned an item last week and wanted to confirm your refund of rupees 1200 was processed. Please check your account.", 0),
    ("Hello, this is the ICICI bank relationship manager. I wanted to inform you about a new fixed deposit scheme with 7.5 percent interest rate. No charges to open.", 0),
    ("Good afternoon. I am from the voter ID center. Your new voter card is ready for collection. Please bring your acknowledgment slip to the nearest center.", 0),
    ("This is a courtesy call from Apollo Hospitals. Your health checkup package booking is confirmed for this Saturday at 9 AM. Please carry your ID.", 0),
    ("Hello, I am calling from Airtel. Your monthly postpaid bill of rupees 499 is generated and due on the 15th. You can pay through the Airtel Thanks app.", 0),
    ("Hi, this is Rahul from the TATA Capital home loan team. I wanted to follow up on your loan application. The status is under verification and we will update you by Friday.", 0),
    ("Good morning. This is an automated reminder from IRCTC. Your train ticket for tomorrow is confirmed. PNR is 2456789012. Have a safe journey.", 0),
    ("Hello, I am calling from the survey team at Zomato. We would like to know about your recent delivery experience. This is completely optional and will take 2 minutes.", 0),
    ("This is the school administration calling. We wanted to inform you that the parent-teacher meeting is rescheduled to next Thursday at 6 PM.", 0),
    ("Hi, I am from the BESCOM electricity department. Your area will have a planned maintenance shutdown on Sunday from 9 AM to 1 PM. Please prepare accordingly.", 0),
    ("Hello, this is a call from the LIC of India. Your policy maturity is coming up next month. Please visit the nearest branch with your policy document to initiate the claim.", 0),
    ("Good evening, I am from the Mahanagar Gas call center. There is a scheduled gas inspection in your building next Monday. Please ensure someone is home between 10 AM and 2 PM.", 0),
    ("Hi, this is calling from Meesho seller support. Your store registration is complete. You can now list your first product on the platform. No fees for the first month.", 0),
    ("This is a reminder from the RTO. Your vehicle fitness certificate is due for renewal this month. You can book an appointment online at our portal.", 0),
    ("Good morning, I am calling from the Department of Posts. Your Speed Post tracking number shows the parcel is out for delivery today. Please be available between 10 AM and 6 PM.", 0),
    ("Hello, I am calling from CRED. Your credit score has improved to 780. You are now eligible for a pre-approved personal loan. There is absolutely no obligation to accept.", 0),
    ("Hi, this is the customer care team at Flipkart. Your exchange request for the laptop has been approved and pickup is scheduled for tomorrow. No charges apply.", 0),
    ("This is a courtesy reminder from your gym. Your monthly membership is due on the 20th. You can renew online or at the front desk. No penalty for late renewal.", 0),
    ("Good afternoon. I am calling from the EPFO helpline. Just confirming that your PF withdrawal request has been processed and the amount will be credited in 7 working days.", 0),
    ("Hi, this is a call from the income tax department. Your ITR for last year has been processed and a refund of rupees 4200 has been issued to your bank. No action needed.", 0),
    ("Hello, I am from the SBI home branch. Your account passbook is ready for collection. Please bring your ID when you visit. The bank is open Monday to Saturday.", 0),
    ("This is a reminder from your building society. The annual general meeting is on Sunday at 5 PM in the community hall. Your attendance is appreciated.", 0),
    ("Good morning, this is calling from Bajaj Finserv. We wanted to confirm that your EMI of rupees 3500 for this month has been received. Thank you.", 0),
    ("Hi, this is the Ola driver who picked you up last night. You left your umbrella in the cab. I have kept it safe and can return it whenever convenient.", 0),
    ("Hello, I am from the National Payments Corporation of India helpline. We just want to inform you that UPI will be under maintenance tonight from 2 AM to 4 AM.", 0),
    # ─── MORE SCAM VARIANTS ──────────────────────────────────────────
    ("Your SIM card is flagged for suspicious activity. I am from the telecom authority. Share your Aadhaar number and OTP to prevent it from being blocked.", 1),
    ("Hello I am your bank manager. Your account shows a transaction from abroad. Please share the OTP immediately to reverse this transaction.", 1),
    ("I am officer Kapoor from the cyber crime cell. We have your IP address linked to illegal downloads. Pay rupees 80000 fine immediately to avoid arrest.", 1),
    ("Congratulations you are selected as Amitabh Bachchan show winner. Your prize amount is 10 lakh. Pay 2000 rupees processing fee to claim it today.", 1),
    ("Your WhatsApp account is hacked from another device. Share the 6 digit verification code we just sent to secure your account right now.", 1),
    ("This is from the GST department. Your business account has a pending fine of rupees 1.5 lakh. Pay immediately to avoid business closure and arrest.", 1),
    ("I am from the pension office. Your pension has been upgraded to rupees 15000 per month but we need your bank account details and Aadhaar to update the records.", 1),
    ("Your loan EMI is overdue and a case will be filed against you today. Pay the outstanding amount of rupees 45000 immediately to avoid legal action.", 1),
    ("Hello this is calling from the health ministry. Free Covid booster dose registration is available. Share your Aadhaar and bank details to confirm your slot.", 1),
    ("Your phone number is being used to spread fake news. I am from the intelligence bureau. Share your location and Aadhaar immediately or face arrest.", 1),
    ("This is a message from the district collector office. Your land is being acquired by the government. Pay rupees 5000 as registration fee to claim your compensation.", 1),
    ("I am from the NABARD loan scheme. Farmers can get 3 lakh loan at zero percent interest. Share your Aadhaar, account number, and bank PIN to process your application.", 1),
    ("Your child's scholarship amount of rupees 50000 has been approved. Share bank account details and OTP to receive the amount by evening.", 1),
    ("This is the IRS equivalent Indian tax authority. We have detected tax evasion of rupees 4 lakh in your returns. Pay the penalty today to close the case.", 1),
    ("I am calling from the RBI governor's office. Your account has been marked for money laundering. Transfer all your money to our safe custodial account immediately.", 1),
    ("Your personal loan from PaySense shows unusual activity. Share your login credentials so our team can check and secure your account.", 1),
    ("This is the SEBI regulatory body. Your stock account shows insider trading. Pay rupees 2 lakh fine immediately or your demat account will be seized.", 1),
    ("I am the deputy commissioner of police. A girl has filed a complaint against you. Pay rupees 1.5 lakh to settle the case out of court.", 1),
    ("Your Uber driver's account shows your last ride had a complaint. To resolve this, confirm your credit card details for a refund of rupees 500.", 1),
    ("This is the PM Kisan yojana helpline. Your annual subsidy of rupees 6000 is ready. Share your bank account number and IFSC code to receive the amount.", 1),
    # ─── MORE LEGITIMATE ─────────────────────────────────────────────
    ("Hello I am calling from the Tata Motors showroom. You had inquired about the Nexon EV last week. We have a new offer available. Is it okay if I send you the brochure?", 0),
    ("Good morning, this is the pathology lab. Your blood test reports are ready and can be collected from our center. We can also email them if you prefer.", 0),
    ("Hi, I am from the housing society committee. Just wanted to inform you that the water supply will be cut tomorrow from 8 AM to 12 PM for pipeline maintenance.", 0),
    ("This is the National Pension System helpline. Your NPS account statement for the financial year is available on the portal. No action required from your side.", 0),
    ("Hello, I am calling from the Canara Bank branch where you have an account. We are conducting a customer satisfaction survey. It is completely voluntary and takes 3 minutes.", 0),
    ("Good afternoon, this is from the Pollution Control Board. There is a vehicle emission check camp in your area this Saturday. Participation is voluntary but encouraged.", 0),
    ("Hi, this is the principal of your child's school. There is a sports day event next week and we would love for parents to attend and cheer for the students.", 0),
    ("This is a call from the local municipal office. New garbage collection timings start from Monday. Morning pickup will be at 7 AM. Please keep your bins ready.", 0),
    ("Hello, I am from the Madhya Pradesh tourism department. We are running a promotion for eco-tourism packages this season. Shall I send you the details on email?", 0),
    ("Good morning. This is the Indane gas agency. Your cylinder booking is confirmed and delivery is expected by tomorrow afternoon. Keep your phone accessible.", 0),
]

def get_texts_and_labels():
    texts = [t for t, _ in TRAINING_DATA]
    labels = [l for _, l in TRAINING_DATA]

    multi_data = load_multilingual_dataset()
    for item in multi_data:
        texts.append(item["transcript"])
        is_scam = 1 if item.get("scam_probability", 0) >= 50 and item.get("category") not in ("LEGITIMATE_SECURITY_WARNING", "NORMAL_CALL") else 0
        labels.append(is_scam)

    return texts, labels
