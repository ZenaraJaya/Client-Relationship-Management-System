$json = @{
    company_name = "Zenara Test Company"
    industry = "Technology"
    location = "Jakarta"
    contact_person = "Test Person"
    role = "Manager"
    phone = "+6212345678"
    email = "test@zenara.com"
    source = "Website"
    pain_point = "Test pain point"
    priority = "High"
    status = "New"
    last_contact = "2026-04-01"
    next_action = "Follow up"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/crms" `
    -Method POST `
    -Headers @{
        'Content-Type' = 'application/json'
        'Accept' = 'application/json'
    } `
    -Body $json `
    -UseBasicParsing

Write-Host "Status Code:" $response.StatusCode
Write-Host "Response:" $response.Content
