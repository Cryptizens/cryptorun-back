import os, json

STATUS = os.environ['status']

def lambda_handler(event, context):
    response = {
        "statusCode": 200,
        "headers": { "Content-Type": "application/json" },
        "body": json.dumps( { "challenge_status": STATUS } )
    }
    return response
