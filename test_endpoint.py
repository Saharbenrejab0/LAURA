import httpx
TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmMmI1Mzk0Ny03YmVhLTQ4MjgtYmI5Ny00MTIzN2QyYmIzNGYiLCJlbWFpbCI6InRoaWJhdWx0QGVzc2lsb3IuY29tIiwicm9sZSI6ImZpbmFuY2UiLCJjbHVzdGVyIjpudWxsLCJleHAiOjE3ODMwODM4Njh9.Qbms-BAk18zSNcc8s0QH9f4vacm2Tk8RwGA4bc9X5s0'
r = httpx.post(
    'http://localhost:8000/chat/ask',
    json={'message': 'test from python script', 'tool': 'deep_search', 'session_id': 'test-session-123'},
    headers={'Authorization': f'Bearer {TOKEN}'},
    timeout=60
)
print(f'Status: {r.status_code}')
print(f'Response: {r.text[:500]}')
