import RPi.GPIO as GPIO
import time


AIN1 = 27  # Pin 13
AIN2 = 17  # Pin 11
BIN1 = 22  # Pin 15
BIN2 = 23  # Pin 16


PWMA = 18  # Pin 12  (steering speed)
PWMB = 19  # Pin 35  (drive speed)


GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

for p in [AIN1, AIN2, BIN1, BIN2, PWMA, PWMB]:
    GPIO.setup(p, GPIO.OUT)

pwmA = GPIO.PWM(PWMA, 1000)  # 1kHz
pwmB = GPIO.PWM(PWMB, 1000)

pwmA.start(0)
pwmB.start(0)

def stop_all():
    GPIO.output(AIN1, 0); GPIO.output(AIN2, 0)
    GPIO.output(BIN1, 0); GPIO.output(BIN2, 0)
    pwmA.ChangeDutyCycle(0)
    pwmB.ChangeDutyCycle(0)

def drive_forward(speed=60):
    GPIO.output(BIN1, 1); GPIO.output(BIN2, 0)
    pwmB.ChangeDutyCycle(speed)

def drive_backward(speed=60):
    GPIO.output(BIN1, 0); GPIO.output(BIN2, 1)
    pwmB.ChangeDutyCycle(speed)

def steer_left(speed=50):
    GPIO.output(AIN1, 1); GPIO.output(AIN2, 0)
    pwmA.ChangeDutyCycle(speed)

def steer_right(speed=50):
    GPIO.output(AIN1, 0); GPIO.output(AIN2, 1)
    pwmA.ChangeDutyCycle(speed)

try:
    print("Stop...")
    stop_all()
    time.sleep(1)

    print("Drive forward...")
    drive_forward(60)
    time.sleep(2)

    print("Stop...")
    stop_all()
    time.sleep(1)

    print("Drive backward...")
    drive_backward(60)
    time.sleep(2)

    print("Stop...")
    stop_all()
    time.sleep(1)

    print("Steer left...")
    steer_left(50)
    time.sleep(1)

    print("Stop...")
    stop_all()
    time.sleep(1)

    print("Steer right...")
    steer_right(50)
    time.sleep(1)

    print("Stop...")
    stop_all()
    time.sleep(1)

finally:
    stop_all()
    pwmA.stop()
    pwmB.stop()
    GPIO.cleanup()
    print("Done + cleaned up.")
