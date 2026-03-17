import importlib
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def make_whisper_mock():
    mock_word = MagicMock()
    mock_word.word = "hello"
    mock_word.start = 0.0
    mock_word.end = 0.4
    mock_word.probability = 0.98

    mock_segment = MagicMock()
    mock_segment.words = [mock_word]

    mock_model = MagicMock()
    mock_model.transcribe.return_value = ([mock_segment], MagicMock())

    mock_whisper = MagicMock()
    mock_whisper.WhisperModel.return_value = mock_model
    return mock_whisper


def test_transcribe_returns_word_results():
    mock_whisper = make_whisper_mock()
    with patch.dict(sys.modules, {"faster_whisper": mock_whisper}):
        import asr as asr_mod

        importlib.reload(asr_mod)
        results = asr_mod.transcribe("/fake/path.mp3", "tiny")

    assert len(results) == 1
    assert results[0].word == "hello"
    assert results[0].start == 0.0
    assert results[0].end == 0.4
    assert results[0].confidence == 0.98


def test_transcribe_strips_whitespace():
    mock_whisper = make_whisper_mock()
    mock_whisper.WhisperModel.return_value.transcribe.return_value[0][0].words[0].word = "  world  "
    with patch.dict(sys.modules, {"faster_whisper": mock_whisper}):
        import asr as asr_mod

        importlib.reload(asr_mod)
        results = asr_mod.transcribe("/fake/path.mp3", "tiny")

    assert results[0].word == "world"


def test_transcribe_segment_without_words():
    mock_segment_no_words = MagicMock()
    mock_segment_no_words.words = None

    mock_model = MagicMock()
    mock_model.transcribe.return_value = ([mock_segment_no_words], MagicMock())

    mock_whisper = MagicMock()
    mock_whisper.WhisperModel.return_value = mock_model

    with patch.dict(sys.modules, {"faster_whisper": mock_whisper}):
        import asr as asr_mod

        importlib.reload(asr_mod)
        results = asr_mod.transcribe("/fake/path.mp3", "tiny")

    assert results == []


def test_merger_assigns_speaker():
    from diarization import SpeakerSegment
    from merger import merge
    from models import WordResult

    words = [WordResult(word="hello", start=0.0, end=0.4, confidence=0.98)]
    segments = [SpeakerSegment(start=0.0, end=1.0, speaker="SPEAKER_01")]

    merged = merge(words, segments)
    assert merged[0].speaker_id == "SPEAKER_01"


def test_merger_fallback_speaker():
    from merger import merge
    from models import WordResult

    words = [WordResult(word="hello", start=5.0, end=5.4, confidence=0.98)]
    merged = merge(words, [])
    assert merged[0].speaker_id == "SPEAKER_00"


def test_merger_fallback_when_no_overlap():
    from diarization import SpeakerSegment
    from merger import merge
    from models import WordResult

    words = [WordResult(word="gap", start=10.0, end=10.4, confidence=0.9)]
    segments = [SpeakerSegment(start=0.0, end=5.0, speaker="SPEAKER_01")]

    merged = merge(words, segments)
    assert merged[0].speaker_id == "SPEAKER_00"


def test_merger_assigns_best_overlap():
    from diarization import SpeakerSegment
    from merger import merge
    from models import WordResult

    words = [WordResult(word="overlap", start=0.8, end=1.2, confidence=0.9)]
    segments = [
        SpeakerSegment(start=0.0, end=1.0, speaker="SPEAKER_01"),
        SpeakerSegment(start=1.0, end=2.0, speaker="SPEAKER_02"),
    ]

    merged = merge(words, segments)
    assert merged[0].speaker_id in ("SPEAKER_01", "SPEAKER_02")


def test_merger_preserves_word_data():
    from diarization import SpeakerSegment
    from merger import merge
    from models import WordResult

    words = [
        WordResult(word="one", start=0.0, end=0.5, confidence=0.95),
        WordResult(word="two", start=1.0, end=1.5, confidence=0.80),
    ]
    segments = [SpeakerSegment(start=0.0, end=2.0, speaker="SPEAKER_00")]

    merged = merge(words, segments)
    assert len(merged) == 2
    assert merged[0].word == "one"
    assert merged[1].word == "two"
    assert merged[0].confidence == 0.95
    assert merged[1].confidence == 0.80


def test_health_endpoint():
    from main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_transcribe_endpoint_returns_202():
    from main import app

    client = TestClient(app, raise_server_exceptions=False)
    payload = {
        "audio_path": "/data/audio/test.mp3",
        "audio_id": "test-uuid-1234",
        "model_size": "tiny",
        "callback_url": "http://api:3001/internal/asr-complete",
    }
    response = client.post("/transcribe", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert data["audio_id"] == "test-uuid-1234"
    assert data["status"] == "accepted"


def _make_mock_asr_module(return_words):
    import types as _types
    mock_asr = _types.ModuleType("asr")
    mock_asr.transcribe = MagicMock(return_value=return_words)
    return mock_asr


def _make_mock_diarization_module(return_segments=None):
    import types as _types
    from diarization import SpeakerSegment
    mock_diar = _types.ModuleType("diarization")
    mock_diar.diarize = MagicMock(return_value=return_segments or [])
    mock_diar.SpeakerSegment = SpeakerSegment
    return mock_diar


def _make_mock_merger_module(return_words):
    import types as _types
    mock_merger = _types.ModuleType("merger")
    mock_merger.merge = MagicMock(return_value=return_words)
    return mock_merger


def test_run_transcription_success():
    import asyncio

    from models import TranscribeRequest, WordResult

    request = TranscribeRequest(
        audio_path="/data/audio/test.mp3",
        audio_id="test-uuid-5678",
        model_size="tiny",
        callback_url="http://api:3001/internal/asr-complete",
    )

    mock_words = [WordResult(word="hello", start=0.0, end=0.4, confidence=0.98)]

    mock_post = AsyncMock()
    mock_client_instance = AsyncMock()
    mock_client_instance.post = mock_post
    mock_client_cm = AsyncMock()
    mock_client_cm.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_cm.__aexit__ = AsyncMock(return_value=False)

    mock_asr_mod = _make_mock_asr_module(mock_words)
    mock_diar_mod = _make_mock_diarization_module([])
    mock_merger_mod = _make_mock_merger_module(mock_words)

    extra_modules = {
        "asr": mock_asr_mod,
        "diarization": mock_diar_mod,
        "merger": mock_merger_mod,
    }
    for key in extra_modules:
        sys.modules.pop(key, None)

    with patch.dict(sys.modules, extra_modules), patch(
        "httpx.AsyncClient"
    ) as mock_httpx_client:
        mock_httpx_client.return_value = mock_client_cm

        import main

        asyncio.run(main.run_transcription(request))

    mock_post.assert_awaited_once()
    call_args = mock_post.await_args
    posted_json = call_args.kwargs["json"]
    assert posted_json["audio_id"] == "test-uuid-5678"
    assert posted_json["status"] == "complete"
    assert len(posted_json["words"]) == 1
    assert posted_json["words"][0]["word"] == "hello"


def test_run_transcription_error_sends_error_callback():
    import asyncio
    import types as _types

    from models import TranscribeRequest

    request = TranscribeRequest(
        audio_path="/data/audio/bad.mp3",
        audio_id="error-uuid",
        model_size="tiny",
        callback_url="http://api:3001/internal/asr-complete",
    )

    mock_post = AsyncMock()
    mock_client_instance = AsyncMock()
    mock_client_instance.post = mock_post
    mock_client_cm = AsyncMock()
    mock_client_cm.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_cm.__aexit__ = AsyncMock(return_value=False)

    bad_asr = _types.ModuleType("asr")
    bad_asr.transcribe = MagicMock(side_effect=RuntimeError("ASR failed"))
    mock_diar_mod = _make_mock_diarization_module([])
    mock_merger_mod = _make_mock_merger_module([])

    extra_modules = {
        "asr": bad_asr,
        "diarization": mock_diar_mod,
        "merger": mock_merger_mod,
    }
    for key in extra_modules:
        sys.modules.pop(key, None)

    with patch.dict(sys.modules, extra_modules), patch(
        "httpx.AsyncClient"
    ) as mock_httpx_client:
        mock_httpx_client.return_value = mock_client_cm

        import main

        asyncio.run(main.run_transcription(request))

    mock_post.assert_awaited_once()
    call_args = mock_post.await_args
    posted_json = call_args.kwargs["json"]
    assert posted_json["audio_id"] == "error-uuid"
    assert posted_json["status"] == "error"
    assert "ASR failed" in posted_json["error"]
    assert posted_json["words"] == []
