package FCS::Client;
use strict;
use warnings;
use Exporter qw(import);
use LWP::UserAgent;
use JSON;

sub new {
    my ($class, %args) = @_;
    return bless {%args}, $class;
}

sub copy {
    my ($self, $fromDir, $toDir, $file) = @_;
    return copyFile($self->{url}, $fromDir, $toDir, $file, 0);
}

sub move {
    my ($self, $fromDir, $toDir, $file) = @_;
    return copyFile($self->{url}, $fromDir, $toDir, $file, 1);
}

sub status {
    my ($self, $id) = @_;

    my $request = HTTP::Request->new(GET => $self->{url} . "/status/" . $id);
    $request->header("content-type", "application/json");
    return request($request);
}

sub request {
    my ($request) = @_;
    my $agent = LWP::UserAgent->new;
    my $response = $agent->request($request);
    if ($response->is_success) {
        my $json = JSON->new->allow_nonref->decode($response->decoded_content);
        return $json;
    } else {
        print $response->code, "\n";
        print $response->message, "\n";
        die("request failed");
    }
}

sub copyFile {
    my ($url, $fromDir, $toDir, $file, $move) = @_;

    my $fullFrom = $fromDir . "/" . $file;
    my $fullTo = $toDir . "/" . $file;
    my $doMove = $move ? "true" : "false";
    my $data = '{"source": "' . $fullFrom . '", "dest": "' . $fullTo . '", "move": ' . $doMove . '}';

    my $request = HTTP::Request->new(POST => $url . "/copy");
    $request->header("content-type", "application/json");
    $request->content($data);
    return request($request);
}

1;
