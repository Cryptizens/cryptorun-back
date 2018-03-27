import sys, os, json
from datetime import datetime
sys.path.append("modules")
import requests

############################
### STRAVA API PARAMETERS ##
############################

# The URL of the API, that we will query to get information on Thomas' activities.
# We have included a 'per_page' query parameter to let Strava know that only the
# X latest activities should be included.
STRAVA_API_ENDPOINT = 'https://www.strava.com/api/v3/athlete/activities?per_page=5'
# The secret token that we need to give to Strava to have access to Thomas'
# activities - because these are private by default. Because we don't want this
# token to be made public for everyone that reads this code, we are storing it
# as an environment variable of the server where the code will be running.
STRAVA_API_TOKEN = os.environ['strava_api_token']
# The specific format along which the token must be communicated to Strava.
HEADERS = {
    'Authorization': 'Bearer ' + STRAVA_API_TOKEN
}
# Specific API data field names
TYPE_FIELD = 'type'
DISTANCE_FIELD = 'distance'
START_LAT_LONG_FIELD = 'start_latlng'
END_LAT_LONG_FIELD = 'end_latlng'


############################
### CHALLENGE PARAMETERS ###
############################

# How the challenge must be accomplished (running, obviously). This is just a
# filter to avoid counting any of Thomas' biking activities recorded on Strava
# to accidentally trigger the challenge accomplishment.
REQUIRED_ACTIVITY_TYPE = 'Run'
# The latest day until which the challenge can be attempted - we take ten more
# days vs the 'official' challenge day to have some buffer in case of unforeseen
# circumstances on the official day. The format is YYYY, MM, DD.
LAST_CHALLENGE_DAY = datetime(2018, 5, 29)
# The minimum distance that must be run for the challenge to be accomplished,
# expressed in meters (Strava's reference unit for distances).
MIN_DISTANCE = 60000
# The geographical areas within which the challenge must happen. We choose a broad
# square around the Brussels region, that is bound by Sint-Pieters-Leeuw in the
# South-West, and by Perk in the North-East. Check out on Google Map how these
# localities nicely englobe the full Brussels area.
# Specifically for the challenge to be considered accomplished, the start and
# end points of the activity must be within this broad square.
# (1) Sint-Pieters-Leeuw
# https://www.google.be/maps/place/Sint-Pieters-Leeuw/@50.7886091,4.2083307,13z/data=!3m1!4b1!4m5!3m4!1s0x47c30fa9e98924bf:0x7e72a8992628f7ff!8m2!3d50.7797834!4d4.2436409?hl=en
SW_BOUND_COORDS = {
    'lat': 50.7886091,
    'lon': 4.2083307
}
# (2) Perk
# https://www.google.be/maps/place/1820+Perk/@50.9348927,4.4871652,15z/data=!3m1!4b1!4m5!3m4!1s0x47c3e767208ad4a1:0xb43ba0a4fd98a073!8m2!3d50.9348491!4d4.4959831?hl=en
NE_BOUND_COORDS = {
    'lat': 50.9348927,
    'lon': 4.4871652
}
# (3) Resulting authorized ranges
AUTHORIZED_LAT_RANGE  = [ SW_BOUND_COORDS['lat'], NE_BOUND_COORDS['lat']]
AUTHORIZED_LON_RANGE = [ SW_BOUND_COORDS['lon'], NE_BOUND_COORDS['lon']]


############################
#### CHALLENGE STATUSES ####
############################

# In order to be sure that we pass only allowed statuses back to the Smart
# Contract that will be querying this Oracle, we define them as constants
ONGOING_STATUS = 'ongoing'
ACCOMPLISHED_STATUS = 'accomplished'
CLOSED_STATUS = 'closed'
FAILED_STATUS = 'failed'


############################
##### AUXILIARY METHODS ####
############################

# Retrieve all of latest Thomas' activities from Strava
def fetch_latest_activities_from_strava():
    # response = requests.get(url, headers=HEADERS)
    # activities = json.loads(response.content)
    # return activities
    # Commented out: for testing purposes, load activities from local machine
    return json.load(open('sample_activities.json'))

# Evaluate if an activity meets the conditions of the challenge
def activity_satisfies_challenge(activity):
    good_type = activity_satisfies_type(activity)
    good_distance = activity_satisfies_distance(activity)
    good_location = activity_satisfies_location(activity)
    return ( good_type & good_distance & good_location )

# Evaluate if an activity if of the 'Run' type
def activity_satisfies_type(activity):
    return activity[TYPE_FIELD] == REQUIRED_ACTIVITY_TYPE

# Evaluate if the distance of an activity is equal or above the minimum
# required distance for the challenge
def activity_satisfies_distance(activity):
    return activity[DISTANCE_FIELD] >= MIN_DISTANCE

# Evaluate if the start and end coordinates of an activity are within the
# range allowed for the challenge (i.e., in the Brussels area)
def activity_satisfies_location(activity):
    start_coord = activity[START_LAT_LONG_FIELD]
    end_coord   = activity[END_LAT_LONG_FIELD]

    start_satisfies_location = coord_within_allowed_range(start_coord[0], start_coord[1])
    end_satisfies_location   = coord_within_allowed_range(end_coord[0], end_coord[1])

    return ( start_satisfies_location & end_satisfies_location)

# Helper method to evaluate one specific point
def coord_within_allowed_range(lat, lon):
    lat_within_bounds = ((AUTHORIZED_LAT_RANGE[0] <= lat) & (lat <= AUTHORIZED_LAT_RANGE[1]))
    lon_within_bounds = ((AUTHORIZED_LON_RANGE[0] <= lon) & (lon <= AUTHORIZED_LON_RANGE[1]))
    return ( lat_within_bounds & lon_within_bounds )

# Helper method to check if challenge period is still ongoing
def still_in_challenge_period():
    return datetime.now() <= LAST_CHALLENGE_DAY


############################
#### MAIN ORACLE METHOD ####
############################

def lambda_handler(event, context):
    # Fetch recent activities from Strava
    activities = fetch_latest_activities_from_strava()

    # By default, initially assume that the challenge is ongoing and that no
    # activity satisfies the conditions.
    challenge_status = ONGOING_STATUS
    any_activity_satisfying_challenge = False

    # We use a very explicit way of looping across all activities here, to
    # make the code very readable - Python is however powerful enough to
    # have the same logic written in one line ;)
    # Go through all recent activities fetched from Strava
    for activity in activities:
        # If an activity satisfies the challenge conditions, flag it - note that
        # we don't interrupt the loop here, meaning several activities could
        # theoretically satisify the challenge. The important thing is that
        # once the flag has been set to True, it cannot be reverted even if a
        # later activity is found not to satisfy the challenge.
        if activity_satisfies_challenge(activity):
            any_activity_satisfying_challenge = True

    # Now we need to include the timing dimension to determine the status of
    # the challenge.
    # If the challenge is still ongoing...
    if still_in_challenge_period():
        # If one of the activities satisfies the conditions, the challenge is
        # accomplished!
        if any_activity_satisfying_challenge:
            challenge_status = ACCOMPLISHED_STATUS
        # Else, the challenge is still ongoing
        else:
            challenge_status = ONGOING_STATUS
    # If the challenge is over...
    else:
        # If one of the activities satisfies the conditions, it means the
        # challenge has been accomplished, and is now closed.
        if any_activity_satisfying_challenge:
            challenge_status = CLOSED_STATUS
        # If no activity has been found satisfying the conditions, it means
        # the challenge was a failure. Note that this will be the end state
        # towards which the challenge will converge after a certain period of
        # time, when enough activities have been done after the challenge so
        # that the satisfying activity is no more part of the list...but by then
        # the funds will have been withdraw from the contract.
        else:
            challenge_status = FAILED_STATUS

    # Finally, we build a proper HTTP response for the Smart Contract that has
    # been querying the endpoint
    response = {
        "statusCode": 200,
        "headers": { "Content-Type": "application/json" },
        "body": json.dumps( { "challenge_status": challenge_status } )
    }
    # And we return it to the API Gateway that has been calling our Lambda function
    return response

# For local development purposes
print(lambda_handler('',''))
