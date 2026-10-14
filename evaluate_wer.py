
from jiwer import wer

# Replace this with the exact words spoken in sample.wav.
reference = """
Welcome to SampleLid.com, a free online resource for downloading sample files in a wide variety of digital formats. Whether you are a software developer testing file upload functionality, a quality assurance engineer validating media players, a student learning about digital formats, or simply someone who needs a quick test file, SampleLid providesready-to-use files that you can download instantly, completely free of charge. In this recording, we will walk you through every aspect of the SampleLid platform, exploring the formats we offer, the technical details behind each one, and themany ways these test files can be used in your projects and workflows. Let us begin with image formats. Images are perhaps the most fundamental type of digital media, and SampleLid offers test files in five major image formats, JPEG, PNG, SVG, GIF, and Web. Each format has its own strengths, trade-offs, and ideal use cases, and understanding these differences is essential.
"""

# Replace this with the actual output from your Whisper small model.
recognized = """
Welcome to SampleLid.com, a free online resource for downloading sample files in a wide variety of digital formats. Whether you are a software developer testing file upload functionality, a quality assurance engineer validating media players, a student learning about digital formats, or simply someone who needs a quick test file, SampleLid provides ready-to-use files that you can download instantly, completely free of charge. In this recording, we will walk you through every aspect of the SampleLid platform, exploring the formats we offer, the technical details behind each one, and the many ways these test files can be used in your projects and workflows. Let us begin with image formats. Images are perhaps the most fundamental type of digital media, and SampleLid offers test files in five major image formats, JPEG, PNG, SVG, GIF, and Web. Each format has its own strengths, trade-offs, and ideal use cases, and understanding these differences is essential.
"""

if "PASTE THE" in reference or "PASTE THE" in recognized:
    print("Please replace both placeholder texts first.")
else:
    error_rate = wer(reference, recognized)

    print(f"Word Error Rate: {error_rate:.2%}")
    print(f"Word Accuracy (1 - WER): {(1 - error_rate):.2%}")
