# Airtable schema for the texting app

Recommended tables:

## Families
- Family Name
- Primary Phone
- Primary Email
- Status
- Notes

## Students
- First Name
- Last Name
- Family link
- Grade
- Class
- Division
- Bus Route
- Active

## Contacts
- Family link
- Name
- Relationship
- Phone
- Email
- SMS Allowed
- Preferred Contact
- Opted Out

## Groups
- Name
- Type: Class, Grade, Bussing, Division, Smart, Manual
- Rule
- Active
- Family Count

## Group Memberships
- Group link
- Family link
- Student link
- Source: Manual, Airtable rule, Import, AI suggestion

## Messages
- Body
- Direction: Inbound, Outbound
- Status: Draft, Queued, Sent, Failed, Received
- Recipient Group
- Created By
- Provider Message ID
- From
- To
- Created Time

## Message Recipients
- Message link
- Family link
- Contact link
- Phone
- Status
- Error
- Provider Message ID

## Templates
- Name
- Category
- Body
- Active
