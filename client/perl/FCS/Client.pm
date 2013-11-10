package FCS::Client;
use strict;
use warnings;
use Exporter qw(import);

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
    shift @_;
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

sub status {
    shift @_;
    my ($url, $id) = @_;

    my $request = HTTP::Request->new(GET => $url . "/status/" . $id);
    $request->header("content-type", "application/json");
    return request($request);
}

1;
